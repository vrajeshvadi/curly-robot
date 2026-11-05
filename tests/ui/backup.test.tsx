import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { backupFileName, exportBackup } from '../../src/data/backup'
import { createDb, type HayDayDB } from '../../src/data/db'
import { saveFarm, setMeta } from '../../src/data/repo'
import { makeFarm } from '../fixtures/builders'
import { renderApp } from './render'

let db: HayDayDB
beforeEach(async () => {
  db = createDb(crypto.randomUUID())
  await saveFarm(db, makeFarm())
  await setMeta(db, 'currentFarmId', 'main')
})
afterEach(() => vi.restoreAllMocks())

const jsonFile = (content: string) => new File([content], 'backup.json', { type: 'application/json' })

test('export downloads a dated file and records the backup', async () => {
  const downloads: string[] = []
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:backup')
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { downloads.push(this.download) })
  renderApp('/more/backup', { db })
  await userEvent.click(await screen.findByRole('button', { name: 'Export backup' }))
  await expect.poll(() => downloads).toEqual([backupFileName(new Date())])
  // Revoking the link straight after click can cancel the download on some phones.
  expect(revoke).not.toHaveBeenCalled()
  expect(await screen.findByText('Last backup: today')).toBeInTheDocument()
})

test('an invalid file is rejected and nothing changes', async () => {
  renderApp('/more/backup', { db })
  await userEvent.upload(await screen.findByLabelText('Import a backup file'), jsonFile('nope'))
  expect(await screen.findByText("This file isn't a valid Hay Day Manager backup.")).toBeInTheDocument()
  expect((await db.farms.toArray()).map((f) => f.id)).toEqual(['main'])
})

test('a valid file replaces everything after confirming', async () => {
  const other = createDb(crypto.randomUUID())
  await saveFarm(other, makeFarm({ id: 'x', name: 'Imported' }))
  const content = JSON.stringify(await exportBackup(other))
  renderApp('/more/backup', { db })
  const user = userEvent.setup()
  await user.upload(await screen.findByLabelText('Import a backup file'), jsonFile(content))
  expect(await screen.findByRole('heading', { name: 'Replace all data?' })).toBeInTheDocument()
  expect((await db.farms.toArray()).map((f) => f.id)).toEqual(['main'])
  await user.click(screen.getByRole('button', { name: 'Replace all data' }))
  await expect.poll(async () => (await db.farms.toArray()).map((f) => f.id)).toEqual(['x'])
})

test('warns when the browser may clear data', async () => {
  await setMeta(db, 'persisted', false)
  renderApp('/more/backup', { db })
  expect(await screen.findByText('Your browser may clear this data. Export a backup regularly.')).toBeInTheDocument()
})
