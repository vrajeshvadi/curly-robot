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
  await saveFarm(db, makeFarm({ fields: 2 }))
  await saveFarm(db, makeFarm({ id: 'b1', name: 'Baby 1' }))
  await setMeta(db, 'currentFarmId', 'main')
  await db.stock.bulkPut([...makeStock('main', { wheat: 1 }), ...makeStock('b1', { corn: 10 })])
  await saveOrder(db, makeOrder('main', { bread: 2 }))
})

const headings = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)

test('sections appear in order and empty ones are hidden', async () => {
  await saveFarm(db, makeFarm({ fields: 2, barnCapacity: 1 }))
  await saveOrder(db, makeOrder('main', { corn: 6, bolt: 1, blackberry_muffin: 1 }))
  renderApp('/plan?orders=all', { db })
  await screen.findByRole('heading', { name: 'Make' })
  expect(headings()).toEqual(['Orders in this plan', 'From stock', 'Transfers', 'Make', 'Plant', "Can't make here", 'Missing', 'Warnings', 'Time'])
})

test('make, plant and transfer rows read clearly', async () => {
  await saveOrder(db, makeOrder('main', { corn: 6 }))
  renderApp('/plan?orders=all', { db })
  const bread = within(await screen.findByRole('listitem', { name: 'Bread × 2' }))
  expect(bread.getByText('Bakery')).toBeInTheDocument()
  expect(bread.getByText('1 refill')).toBeInTheDocument()
  expect(screen.getByText('Wheat × 5 fields')).toBeInTheDocument()
  expect(screen.getByText('Baby 1 → Main: Corn × 6')).toBeInTheDocument()
})

test('switching off other farms removes transfers', async () => {
  await saveOrder(db, makeOrder('main', { corn: 6 }))
  renderApp('/plan?orders=all', { db })
  await screen.findByRole('heading', { name: 'Transfers' })
  await userEvent.click(screen.getByLabelText('Use other farms'))
  expect(screen.queryByRole('heading', { name: 'Transfers' })).not.toBeInTheDocument()
})

test('time shows the overall estimate', async () => {
  renderApp('/plan?orders=all', { db })
  expect(await screen.findByText('About 16 min (estimate)')).toBeInTheDocument()
})

test('"Made 1 batch" updates stock and the plan', async () => {
  await db.stock.put({ farmId: 'main', itemId: 'wheat', total: 6, min: 0 })
  renderApp('/plan?orders=all', { db })
  const user = userEvent.setup()
  await user.click(within(await screen.findByRole('listitem', { name: 'Bread × 2' })).getByRole('button', { name: 'Made 1 batch' }))
  await expect.poll(async () => (await db.stock.get(['main', 'bread']))?.total).toBe(1)
  expect((await db.stock.get(['main', 'wheat']))?.total).toBe(3)
  expect(await screen.findByRole('listitem', { name: 'Bread × 1' })).toBeInTheDocument()
})

test('unticking an order leaves it out of the plan', async () => {
  renderApp('/plan?orders=all', { db })
  const user = userEvent.setup()
  await user.click(await screen.findByLabelText('Truck: Bread × 2'))
  expect(screen.queryByRole('heading', { name: 'Make' })).not.toBeInTheDocument()
  expect(screen.getByText('Nothing to plan yet. Tick an order or add a low-stock item.')).toBeInTheDocument()
})

test('a top-up added on Home shows as a removable chip', async () => {
  await db.stock.put({ farmId: 'main', itemId: 'corn', total: 0, min: 4 })
  renderApp('/', { db })
  const user = userEvent.setup()
  await user.click(within(await screen.findByRole('listitem', { name: 'Corn low' })).getByRole('button', { name: 'Add to to-make' }))
  await user.click(screen.getByRole('link', { name: 'Plan all open orders' }))
  const chip = await screen.findByRole('button', { name: 'Remove Corn top-up' })
  expect(screen.getByText('Baby 1 → Main: Corn × 4')).toBeInTheDocument()
  await user.click(chip)
  expect(screen.queryByText('Baby 1 → Main: Corn × 4')).not.toBeInTheDocument()
})
