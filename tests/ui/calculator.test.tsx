import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { createDb } from '../../src/data/db'
import { saveFarm, setMeta } from '../../src/data/repo'
import { makeFarm, makeStock } from '../fixtures/builders'
import { renderApp } from './render'

test('calculator breaks an item down against empty stock or my stock', async () => {
  const db = createDb(crypto.randomUUID())
  await saveFarm(db, makeFarm())
  await setMeta(db, 'currentFarmId', 'main')
  await db.stock.bulkPut(makeStock('main', { wheat: 150 }))
  renderApp('/more/calculator', { db })
  const user = userEvent.setup()

  await user.type(await screen.findByLabelText('Find an item'), 'bread')
  await user.click(screen.getByRole('button', { name: 'Add Bread' }))
  await user.clear(screen.getByLabelText('Quantity'))
  await user.type(screen.getByLabelText('Quantity'), '50')

  expect(await screen.findByRole('listitem', { name: 'Bread × 50' })).toBeInTheDocument()
  expect(screen.getByText('Wheat × 150 fields')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'My stock' }))
  expect(screen.queryByText('Wheat × 150 fields')).not.toBeInTheDocument()
  expect(screen.getByText('Wheat × 150')).toBeInTheDocument()
})
