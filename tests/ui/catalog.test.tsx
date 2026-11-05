import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test } from 'vitest'
import { createDb, type HayDayDB } from '../../src/data/db'
import { saveFarm, saveOrder, setMeta } from '../../src/data/repo'
import { makeFarm, makeOrder } from '../fixtures/builders'
import { renderApp } from './render'

let db: HayDayDB
beforeEach(async () => {
  db = createDb(crypto.randomUUID())
  await saveFarm(db, makeFarm())
  await setMeta(db, 'currentFarmId', 'main')
})

test('catalog search lists matching items', async () => {
  renderApp('/more/catalog', { db })
  await userEvent.type(await screen.findByLabelText('Search the catalog'), 'corn')
  expect(screen.getByRole('link', { name: /^Corn\b/ })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /^Cornbread/ })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /^Wheat/ })).not.toBeInTheDocument()
})

test('item detail shows its recipe and where it is used', async () => {
  renderApp('/more/catalog/wheat', { db })
  const usedIn = await screen.findByRole('list', { name: 'Used in' })
  expect(within(usedIn).getAllByRole('link').map((a) => a.textContent)).toEqual(['Blackberry Muffin', 'Bread', 'Chicken Feed'])
})

test('editing an item marks it edited, and reset restores the original', async () => {
  renderApp('/more/catalog/bread/edit', { db })
  const user = userEvent.setup()
  const yieldField = await screen.findByLabelText('Makes per batch')
  await user.clear(yieldField)
  await user.type(yieldField, '2')
  await user.click(screen.getByRole('button', { name: 'Save item' }))
  expect(await screen.findByText('Edited')).toBeInTheDocument()
  expect(screen.getByText('Makes 2 per batch')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Reset to original' }))
  expect(await screen.findByText('Makes 1 per batch')).toBeInTheDocument()
  expect(screen.queryByText('Edited')).not.toBeInTheDocument()
})

test('an edit that makes a recipe loop is not saved', async () => {
  renderApp('/more/catalog/bread/edit', { db })
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Add ingredient'), 'bread')
  await user.click(screen.getByRole('button', { name: 'Add Bread' }))
  await user.click(screen.getByRole('button', { name: 'Save item' }))
  expect(await screen.findByText(/Recipe loop: Bread → Bread/)).toBeInTheDocument()
  expect(await db.overrides.count()).toBe(0)
})

test('a custom item can be added, and deleting it is blocked while an order uses it', async () => {
  renderApp('/more/catalog/new', { db })
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Name'), 'Jam')
  await user.selectOptions(screen.getByLabelText('Made by'), 'machine:bakery')
  await user.type(screen.getByLabelText('Add ingredient'), 'apple')
  await user.click(screen.getByRole('button', { name: 'Add Apple' }))
  await user.click(screen.getByRole('button', { name: 'Save item' }))
  expect(await screen.findByRole('heading', { name: 'Jam' })).toBeInTheDocument()
  expect(await db.customItems.get('jam')).toMatchObject({ name: 'Jam', category: 'made',
    source: { kind: 'machine', machineId: 'bakery', ingredients: [{ itemId: 'apple', qty: 1 }] } })

  await saveOrder(db, makeOrder('main', { jam: 1 }))
  await user.click(screen.getByRole('button', { name: 'Delete item' }))
  await user.click(screen.getByRole('button', { name: 'Delete Jam' }))
  expect(await screen.findByText('Jam is in an open order. Finish or edit that order first.')).toBeInTheDocument()
  expect(await db.customItems.count()).toBe(1)
})
