import { beforeEach, expect, test } from 'vitest'
import { backupFileName, exportBackup, importBackup, parseBackup } from '../../src/data/backup'
import { createDb, type HayDayDB } from '../../src/data/db'
import { getMeta, saveCustomItem, saveFarm, saveOrder, saveOverride } from '../../src/data/repo'
import { makeFarm, makeOrder, makeStock } from '../fixtures/builders'
import { testCatalog } from '../fixtures/testCatalog'

let db: HayDayDB
beforeEach(async () => {
  db = createDb(crypto.randomUUID())
  await saveFarm(db, makeFarm())
  await saveFarm(db, makeFarm({ id: 'b1', name: 'Baby 1' }))
  await db.stock.bulkPut([...makeStock('main', { wheat: 3, ghost: 2 }), ...makeStock('b1', { corn: { total: 4, min: 2 } })])
  await saveOrder(db, makeOrder('main', { bread: 2 }, { reserve: true }))
  await saveOverride(db, { itemId: 'bread', item: { ...testCatalog.items.bread, name: 'Bread!' } })
  await saveCustomItem(db, { ...testCatalog.items.bolt, id: 'nail', name: 'Nail' })
})

const strip = <T extends { exportedAt: string }>(b: T) => ({ ...b, exportedAt: '' })

test('export then import into a fresh database gives the same data', async () => {
  const first = await exportBackup(db)
  const fresh = createDb(crypto.randomUUID())
  const parsed = parseBackup(JSON.parse(JSON.stringify(first)))
  if (!parsed.ok) throw new Error(parsed.error)
  await importBackup(fresh, parsed.data)
  expect(strip(await exportBackup(fresh))).toEqual(strip(first))
})

test('stock for an item not in the catalog survives the round trip', async () => {
  const b = await exportBackup(db)
  expect(b.stock).toContainEqual({ farmId: 'main', itemId: 'ghost', total: 2, min: 0 })
})

test('import replaces existing data', async () => {
  const other = createDb(crypto.randomUUID())
  await saveFarm(other, makeFarm({ id: 'x', name: 'Other' }))
  const b = await exportBackup(db)
  await importBackup(other, b)
  expect((await other.farms.toArray()).map((f) => f.id).sort()).toEqual(['b1', 'main'])
})

test.each([
  ['wrong schema version', async () => ({ ...(await exportBackup(db)), schemaVersion: 2 })],
  ['wrong app', async () => ({ ...(await exportBackup(db)), app: 'other' })],
  ['not an object', async () => 'nope'],
  ['bad stock row', async () => ({ ...(await exportBackup(db)), stock: [{ farmId: 'main', itemId: 'wheat', total: -1, min: 0 }] })],
])('rejects %s', async (_l, make) => {
  const r = parseBackup(await make())
  expect(r.ok).toBe(false)
})

test('export records the last backup time', async () => {
  const now = new Date('2026-11-05T08:00:00.000Z')
  const b = await exportBackup(db, now)
  expect(b.exportedAt).toBe('2026-11-05T08:00:00.000Z')
  expect(await getMeta(db, 'lastBackupAt')).toBe('2026-11-05T08:00:00.000Z')
  expect(b).toMatchObject({ app: 'hay-day-manager', schemaVersion: 1 })
})

test('file name uses the local date', () => {
  expect(backupFileName(new Date(2026, 10, 5, 23, 30))).toBe('hay-day-backup-2026-11-05.json')
})
