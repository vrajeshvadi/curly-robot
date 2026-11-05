import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test } from 'vitest'
import { createDb, type HayDayDB } from '../../src/data/db'
import { saveFarm, saveOrder, setMeta } from '../../src/data/repo'
import { makeFarm, makeOrder, makeStock } from '../fixtures/builders'
import { renderApp } from './render'

let db: HayDayDB
beforeEach(async () => {
  db = createDb(crypto.randomUUID())
  await saveFarm(db, makeFarm())
  await setMeta(db, 'currentFarmId', 'main')
  await db.stock.bulkPut(makeStock('main', { wheat: { total: 5, min: 3 }, bread: 2, corn: 1 }))
  await saveOrder(db, makeOrder('main', { wheat: 4 }, { reserve: true }))
})

const row = async (name: string) => screen.findByRole('listitem', { name })
const total = async (itemId: string) => (await db.stock.get(['main', itemId]))?.total

test('rows show total, reserved, free and minimum', async () => {
  renderApp('/stock', { db })
  const wheat = within(await row('Wheat'))
  expect(wheat.getByText('5')).toBeInTheDocument()
  expect(wheat.getByText('4 reserved')).toBeInTheDocument()
  expect(wheat.getByText('1 free')).toBeInTheDocument()
  expect(wheat.getByText('Min 3')).toBeInTheDocument()
})

test('locked items are hidden until "Show locked" is on', async () => {
  renderApp('/stock', { db })
  await row('Wheat')
  expect(screen.queryByRole('listitem', { name: 'Blackberry Muffin' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByLabelText('Show locked'))
  expect(await row('Blackberry Muffin')).toBeInTheDocument()
})

test('reserved above total shows a warning', async () => {
  await saveOrder(db, makeOrder('main', { wheat: 3 }, { reserve: true }))
  renderApp('/stock', { db })
  expect(within(await row('Wheat')).getByText('More reserved than in stock')).toBeInTheDocument()
})

test('search and storage filter narrow the list', async () => {
  renderApp('/stock', { db })
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Search items'), 'whe')
  expect(screen.getByRole('listitem', { name: 'Wheat' })).toBeInTheDocument()
  expect(screen.queryByRole('listitem', { name: 'Corn' })).not.toBeInTheDocument()
  await user.clear(screen.getByLabelText('Search items'))
  await user.click(screen.getByRole('button', { name: 'Silo' }))
  expect(screen.queryByRole('listitem', { name: 'Bread' })).not.toBeInTheDocument()
  expect(screen.getByRole('listitem', { name: 'Corn' })).toBeInTheDocument()
})

test('+ adds one to the total', async () => {
  renderApp('/stock', { db })
  await userEvent.click(within(await row('Wheat')).getByRole('button', { name: 'Add 1 Wheat' }))
  await expect.poll(() => total('wheat')).toBe(6)
})

test('a typed count that is not a whole number is rejected and nothing changes', async () => {
  renderApp('/stock', { db })
  const user = userEvent.setup()
  await user.click(within(await row('Wheat')).getByRole('button', { name: 'Edit Wheat' }))
  const count = screen.getByLabelText('Count')
  await user.clear(count)
  await user.type(count, 'abc')
  expect(screen.getByText('Enter a whole number')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(await total('wheat')).toBe(5)
})

test('editing count and minimum saves both', async () => {
  renderApp('/stock', { db })
  const user = userEvent.setup()
  await user.click(within(await row('Corn')).getByRole('button', { name: 'Edit Corn' }))
  await user.clear(screen.getByLabelText('Count'))
  await user.type(screen.getByLabelText('Count'), '12')
  await user.clear(screen.getByLabelText('Minimum'))
  await user.type(screen.getByLabelText('Minimum'), '4')
  await user.click(screen.getByRole('button', { name: 'Save' }))
  await expect.poll(async () => db.stock.get(['main', 'corn'])).toEqual({ farmId: 'main', itemId: 'corn', total: 12, min: 4 })
})

test('quick count: Cancel writes nothing, Done writes entered items only', async () => {
  renderApp('/stock/count', { db })
  const user = userEvent.setup()
  expect(await screen.findByRole('heading', { name: 'Corn' })).toBeInTheDocument()
  await user.clear(screen.getByLabelText('Count'))
  await user.type(screen.getByLabelText('Count'), '3')
  await user.click(screen.getByRole('button', { name: 'Next' }))
  expect(screen.getByRole('heading', { name: 'Wheat' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(await total('corn')).toBe(1)

  await user.click(await screen.findByRole('link', { name: 'Quick count' }))
  await user.clear(await screen.findByLabelText('Count'))
  await user.type(screen.getByLabelText('Count'), '3')
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await user.click(screen.getByRole('button', { name: 'Skip' }))
  await user.click(screen.getByRole('button', { name: 'Done' }))
  await expect.poll(() => total('corn')).toBe(3)
  expect(await total('wheat')).toBe(5)
})
