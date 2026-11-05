import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { createDb } from '../../src/data/db'
import { saveFarm } from '../../src/data/repo'
import { makeFarm } from '../fixtures/builders'
import { renderApp } from './render'

test('adding a farm selects it in the switcher', async () => {
  const { db } = renderApp('/more/farms/new')
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Farm name'), 'Main')
  await user.clear(screen.getByLabelText('Level'))
  await user.type(screen.getByLabelText('Level'), '20')
  await user.clear(screen.getByLabelText('Fields'))
  await user.type(screen.getByLabelText('Fields'), '12')
  await user.click(screen.getByRole('button', { name: 'Save farm' }))

  const switcher = await screen.findByRole('combobox', { name: 'Farm' })
  expect(screen.getByRole('option', { name: 'Main' })).toBeInTheDocument()
  const [saved] = await db.farms.toArray()
  expect(saved).toMatchObject({ name: 'Main', level: 20, fields: 12 })
  expect(saved.machines.bakery.owned).toBe(true)
  expect(switcher).toHaveValue(saved.id)
})

test('the form shows only machines unlocked at the level until "Show locked" is on', async () => {
  renderApp('/more/farms/new')
  const user = userEvent.setup()
  await user.clear(await screen.findByLabelText('Level'))
  await user.type(screen.getByLabelText('Level'), '1')
  expect(screen.getByText('Feed Mill')).toBeInTheDocument()
  expect(screen.queryByText('Bakery')).not.toBeInTheDocument()
  await user.click(screen.getByLabelText('Show locked'))
  expect(screen.getByText('Bakery')).toBeInTheDocument()
})

test('a farm name is required', async () => {
  renderApp('/more/farms/new')
  await userEvent.click(await screen.findByRole('button', { name: 'Save farm' }))
  expect(screen.getByText('Give the farm a name')).toBeInTheDocument()
})

test('deleting a farm asks first, then removes it', async () => {
  const db = createDb(crypto.randomUUID())
  await saveFarm(db, makeFarm())
  await saveFarm(db, makeFarm({ id: 'b1', name: 'Baby 1' }))
  renderApp('/more/farms/b1', { db })
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Delete farm' }))
  expect(screen.getByText(/Delete Baby 1\?/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Delete Baby 1' }))
  await expect.poll(async () => (await db.farms.toArray()).map((f) => f.id)).toEqual(['main'])
})
