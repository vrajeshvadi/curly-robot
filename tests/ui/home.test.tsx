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
  await db.stock.bulkPut(makeStock('main', { wheat: { total: 1, min: 5 }, bolt: 8, bread: 2 }))
  await saveOrder(db, makeOrder('main', { bread: 2 }))
  await saveOrder(db, makeOrder('main', { corn: 3 }, { type: 'boat' }))
})

test('open orders show a "Can fill now" badge where they fit', async () => {
  renderApp('/', { db })
  const bread = await screen.findByRole('listitem', { name: 'Bread × 2' })
  expect(within(bread).getByText('Can fill now')).toBeInTheDocument()
  expect(within(screen.getByRole('listitem', { name: 'Corn × 3' })).queryByText('Can fill now')).not.toBeInTheDocument()
})

test('low stock can be added to the to-make list', async () => {
  renderApp('/', { db })
  const wheat = await screen.findByRole('listitem', { name: 'Wheat low' })
  expect(within(wheat).getByText('1 of 5')).toBeInTheDocument()
  await userEvent.click(within(wheat).getByRole('button', { name: 'Add to to-make' }))
  expect(within(wheat).getByRole('button', { name: 'Added' })).toBeDisabled()
})

test('barn and silo show used and capacity', async () => {
  renderApp('/', { db })
  expect(await screen.findByText('Barn 10 / 100')).toBeInTheDocument()
  expect(screen.getByText('Silo 1 / 100')).toBeInTheDocument()
})

test('"Plan all open orders" opens the plan with every order', async () => {
  renderApp('/', { db })
  await userEvent.click(await screen.findByRole('link', { name: 'Plan all open orders' }))
  expect(window.location.hash).toBe('#/plan?orders=all')
})
