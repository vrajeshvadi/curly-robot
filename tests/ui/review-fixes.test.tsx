import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test } from 'vitest'
import { createDb, type HayDayDB } from '../../src/data/db'
import { saveCustomItem, saveFarm, saveOrder, setMeta } from '../../src/data/repo'
import { makeFarm, makeOrder, makeStock } from '../fixtures/builders'
import { renderApp } from './render'

let db: HayDayDB
beforeEach(async () => {
  db = createDb(crypto.randomUUID())
  await saveFarm(db, makeFarm())
  await setMeta(db, 'currentFarmId', 'main')
})

test('quick count starts custom items at their real count, not 0', async () => {
  await saveCustomItem(db, { id: 'aaa_jam', name: 'Aaa Jam', category: 'crop', storage: 'silo', unlockLevel: 1,
    source: { kind: 'field', seedUsed: 1, harvestYield: 2, minutes: 5 } })
  await db.stock.bulkPut(makeStock('main', { aaa_jam: 9 }))
  renderApp('/stock/count', { db })
  expect(await screen.findByRole('heading', { name: 'Aaa Jam' })).toBeInTheDocument()
  expect(screen.getByLabelText('Count')).toHaveValue('9')
})

test('switching farm during quick count starts over with that farm’s counts', async () => {
  await saveFarm(db, makeFarm({ id: 'z', name: 'Zed' }))
  await db.stock.bulkPut([...makeStock('main', { corn: 11 }), ...makeStock('z', { corn: 22 })])
  renderApp('/stock/count', { db })
  const user = userEvent.setup()
  expect(await screen.findByLabelText('Count')).toHaveValue('11')
  await user.selectOptions(screen.getByRole('combobox', { name: 'Farm' }), 'z')
  await expect.poll(() => (screen.getByLabelText('Count') as HTMLInputElement).value).toBe('22')
  await user.click(screen.getByRole('button', { name: 'Done' }))
  await expect.poll(async () => (await db.stock.get(['z', 'corn']))?.total).toBe(22)
})

test('removing a line with a bad quantity does not block saving the order', async () => {
  renderApp('/orders/new', { db })
  const user = userEvent.setup()
  const search = await screen.findByLabelText('Find an item')
  await user.type(search, 'bread')
  await user.click(screen.getByRole('button', { name: 'Add Bread' }))
  await user.clear(screen.getByLabelText('Bread quantity'))
  await user.click(screen.getByRole('button', { name: 'Remove Bread' }))
  await user.type(search, 'wheat')
  await user.click(screen.getByRole('button', { name: 'Add Wheat' }))
  await user.click(screen.getByRole('button', { name: 'Save order' }))
  await expect.poll(async () => (await db.orders.toArray()).map((o) => o.lines)).toEqual([[{ itemId: 'wheat', qty: 1 }]])
})

test('removing an ingredient with a bad quantity does not block saving the item', async () => {
  renderApp('/more/catalog/bread/edit', { db })
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Add ingredient'), 'corn')
  await user.click(screen.getByRole('button', { name: 'Add Corn' }))
  await user.clear(screen.getByLabelText('Corn needed'))
  await user.click(screen.getByRole('button', { name: 'Remove Corn' }))
  await user.clear(screen.getByLabelText('Makes per batch'))
  await user.type(screen.getByLabelText('Makes per batch'), '2')
  await user.click(screen.getByRole('button', { name: 'Save item' }))
  expect(await screen.findByText('Makes 2 per batch')).toBeInTheDocument()
})

test('a bad value in a field that gets hidden does not block saving the farm', async () => {
  renderApp('/more/farms/new', { db })
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Farm name'), 'Tiny')
  await user.clear(screen.getByLabelText('Chicken'))
  await user.type(screen.getByLabelText('Chicken'), 'x')
  await user.clear(screen.getByLabelText('Level'))
  await user.type(screen.getByLabelText('Level'), '0')
  await user.click(screen.getByRole('button', { name: 'Save farm' }))
  await expect.poll(async () => (await db.farms.toArray()).some((f) => f.name === 'Tiny')).toBe(true)
})

test('"Made 1 batch" says which ingredients were short', async () => {
  await saveOrder(db, makeOrder('main', { bread: 2 }))
  renderApp('/plan?orders=all', { db })
  await userEvent.click(within(await screen.findByRole('listitem', { name: 'Bread × 2' })).getByRole('button', { name: 'Made 1 batch' }))
  expect(await screen.findByText(/Wheat short by 3/)).toBeInTheDocument()
})

test('orders can include locked items when "Show locked" is on', async () => {
  await saveFarm(db, makeFarm({ fields: 0 }))
  renderApp('/orders/new', { db })
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Find an item'), 'wheat')
  expect(screen.queryByRole('button', { name: 'Add Wheat' })).not.toBeInTheDocument()
  await user.click(screen.getByLabelText('Show locked items'))
  expect(screen.getByRole('button', { name: 'Add Wheat' })).toBeInTheDocument()
})

test('stock can be filtered by category', async () => {
  renderApp('/stock', { db })
  await screen.findByRole('listitem', { name: 'Wheat' })
  await userEvent.selectOptions(screen.getByLabelText('Category'), 'made')
  expect(screen.getByRole('listitem', { name: 'Bread' })).toBeInTheDocument()
  expect(screen.queryByRole('listitem', { name: 'Wheat' })).not.toBeInTheDocument()
})
