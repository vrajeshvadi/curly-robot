import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { saveFarm, setMeta } from '../../src/data/repo'
import { createDb } from '../../src/data/db'
import { makeFarm } from '../fixtures/builders'
import { renderApp } from './render'

test('with no farms, Home asks for the first farm', async () => {
  renderApp('/')
  const link = await screen.findByRole('link', { name: 'Add your first farm' })
  expect(link).toHaveAttribute('href', '#/more/farms/new')
})

test('bottom bar links to the five main screens', async () => {
  renderApp('/')
  const nav = await screen.findByRole('navigation', { name: 'Main' })
  for (const name of ['Home', 'Stock', 'Orders', 'Plan', 'More']) {
    expect(within(nav).getByRole('link', { name })).toBeInTheDocument()
  }
})

test('switching farm in the switcher changes the current farm', async () => {
  const db = createDb(crypto.randomUUID())
  await saveFarm(db, makeFarm())
  await saveFarm(db, makeFarm({ id: 'b1', name: 'Baby 1' }))
  await setMeta(db, 'currentFarmId', 'main')
  renderApp('/', { db })
  const switcher = await screen.findByRole('combobox', { name: 'Farm' })
  expect(switcher).toHaveValue('main')
  await userEvent.selectOptions(switcher, 'b1')
  expect(switcher).toHaveValue('b1')
  await expect.poll(async () => (await db.meta.get('currentFarmId'))?.value).toBe('b1')
})
