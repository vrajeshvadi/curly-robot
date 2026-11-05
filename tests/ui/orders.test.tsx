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
})

test('tabs show open orders of that type', async () => {
  await saveOrder(db, makeOrder('main', { bread: 2 }))
  await saveOrder(db, makeOrder('main', { corn: 9 }, { type: 'boat' }))
  await saveOrder(db, makeOrder('main', { egg: 1 }, { status: 'done' }))
  renderApp('/orders', { db })
  expect(await screen.findByRole('listitem', { name: 'Bread × 2' })).toBeInTheDocument()
  expect(screen.queryByRole('listitem', { name: 'Corn × 9' })).not.toBeInTheDocument()
  expect(screen.queryByRole('listitem', { name: 'Egg × 1' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('tab', { name: /^Boat/ }))
  expect(await screen.findByRole('listitem', { name: 'Corn × 9' })).toBeInTheDocument()
})

test('a new order merges the same item picked twice, and saves the reserve switch', async () => {
  renderApp('/orders/new', { db })
  const user = userEvent.setup()
  const search = await screen.findByLabelText('Find an item')
  await user.type(search, 'bre')
  await user.click(screen.getByRole('button', { name: 'Add Bread' }))
  await user.type(search, 'bre')
  await user.click(screen.getByRole('button', { name: 'Add Bread' }))
  const [first, second] = screen.getAllByLabelText('Bread quantity')
  await user.clear(first); await user.type(first, '2')
  await user.clear(second); await user.type(second, '3')
  await user.click(screen.getByLabelText('Reserve stock for this order'))
  await user.click(screen.getByRole('button', { name: 'Save order' }))

  await expect.poll(async () => (await db.orders.toArray()).length).toBe(1)
  const [o] = await db.orders.toArray()
  expect(o).toMatchObject({ farmId: 'main', type: 'truck', reserve: true, status: 'open', lines: [{ itemId: 'bread', qty: 5 }] })
})

test('the picker does not offer locked items', async () => {
  renderApp('/orders/new', { db })
  await userEvent.type(await screen.findByLabelText('Find an item'), 'muffin')
  expect(screen.queryByRole('button', { name: 'Add Blackberry Muffin' })).not.toBeInTheDocument()
})

test('mark done with enough stock deducts it and closes the order', async () => {
  await db.stock.bulkPut(makeStock('main', { bread: 3 }))
  await saveOrder(db, makeOrder('main', { bread: 2 }))
  renderApp('/orders', { db })
  const user = userEvent.setup()
  await user.click(within(await screen.findByRole('listitem', { name: 'Bread × 2' })).getByRole('button', { name: 'Mark done' }))
  expect(await screen.findByText('Bread −2')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Mark done' }))
  await expect.poll(async () => (await db.stock.get(['main', 'bread']))?.total).toBe(1)
  expect(screen.queryByRole('listitem', { name: 'Bread × 2' })).not.toBeInTheDocument()
})

test('mark done with short stock warns before going ahead', async () => {
  await db.stock.bulkPut(makeStock('main', { wheat: 1 }))
  await saveOrder(db, makeOrder('main', { wheat: 3 }))
  renderApp('/orders', { db })
  const user = userEvent.setup()
  await user.click(within(await screen.findByRole('listitem', { name: 'Wheat × 3' })).getByRole('button', { name: 'Mark done' }))
  expect(await screen.findByText('Your counts may be out of date')).toBeInTheDocument()
  expect(screen.getByText('Wheat short by 2')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Fix counts' })).toHaveAttribute('href', '#/stock')
  await user.click(screen.getByRole('button', { name: 'Mark done anyway' }))
  await expect.poll(async () => (await db.orders.toArray())[0].status).toBe('done')
})

test('"Can fill now" appears only on orders that fit in stock', async () => {
  await db.stock.bulkPut(makeStock('main', { bread: 2 }))
  await saveOrder(db, makeOrder('main', { bread: 2 }))
  await saveOrder(db, makeOrder('main', { corn: 1 }))
  renderApp('/orders', { db })
  expect(within(await screen.findByRole('listitem', { name: 'Bread × 2' })).getByText('Can fill now')).toBeInTheDocument()
  expect(within(screen.getByRole('listitem', { name: 'Corn × 1' })).queryByText('Can fill now')).not.toBeInTheDocument()
})
