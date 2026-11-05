import { z } from 'zod'
import type { CatalogOverride, Farm, Item, Order, StockRow } from '../types'
import type { HayDayDB } from './db'
import { setMeta } from './repo'

export interface BackupFile {
  app: 'hay-day-manager'
  schemaVersion: 1
  exportedAt: string
  farms: Farm[]
  stock: StockRow[]
  orders: Order[]
  catalogOverrides: CatalogOverride[]
  customItems: Item[]
}

const count = z.number().int().nonnegative()
const id = z.string().min(1)
const ingredient = z.object({ itemId: id, qty: z.number().positive() })

const source = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('field'), seedUsed: count, harvestYield: z.number().positive(), minutes: z.number().positive() }),
  z.object({ kind: z.literal('tree'), treeId: id, yield: z.number().positive(), minutes: z.number().positive() }),
  z.object({ kind: z.literal('animal'), animalId: id, yield: z.number().positive(), minutes: z.number().positive(), ingredients: z.array(ingredient) }),
  z.object({ kind: z.literal('machine'), machineId: id, yield: z.number().positive(), minutes: z.number().positive(), ingredients: z.array(ingredient) }),
  z.object({ kind: z.literal('none') }),
])

const item = z.object({
  id,
  name: z.string().min(1),
  category: z.enum(['crop', 'tree', 'animal', 'made', 'material']),
  storage: z.enum(['barn', 'silo']),
  unlockLevel: count,
  source,
})

const farm = z.object({
  id,
  name: z.string().min(1),
  level: count,
  barnCapacity: count,
  siloCapacity: count,
  fields: count,
  machines: z.record(z.string(), z.object({ owned: z.boolean(), slots: count })),
  animals: z.record(z.string(), count),
  trees: z.record(z.string(), count),
})

const backupSchema = z.object({
  app: z.literal('hay-day-manager'),
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  farms: z.array(farm),
  stock: z.array(z.object({ farmId: id, itemId: id, total: count, min: count })),
  orders: z.array(z.object({
    id,
    farmId: id,
    type: z.enum(['truck', 'boat', 'visitor']),
    lines: z.array(ingredient),
    reserve: z.boolean(),
    status: z.enum(['open', 'done']),
    createdAt: z.string(),
  })),
  catalogOverrides: z.array(z.object({ itemId: id, item })),
  customItems: z.array(item),
})

export async function exportBackup(db: HayDayDB, now: Date = new Date()): Promise<BackupFile> {
  const exportedAt = now.toISOString()
  const data = await db.transaction('r', [db.farms, db.stock, db.orders, db.overrides, db.customItems], async () => ({
    farms: await db.farms.toArray(),
    stock: await db.stock.toArray(),
    orders: await db.orders.toArray(),
    catalogOverrides: await db.overrides.toArray(),
    customItems: await db.customItems.toArray(),
  }))
  await setMeta(db, 'lastBackupAt', exportedAt)
  return { app: 'hay-day-manager', schemaVersion: 1, exportedAt, ...data }
}

export function backupFileName(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `hay-day-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`
}

export function parseBackup(json: unknown): { ok: true; data: BackupFile } | { ok: false; error: string } {
  const r = backupSchema.safeParse(json)
  if (r.success) return { ok: true, data: r.data as BackupFile }
  const first = r.error.issues[0]
  return { ok: false, error: first ? `${first.path.join('.') || 'file'}: ${first.message}` : 'Invalid backup' }
}

/** Clears every data table (not meta) and writes the backup, in one transaction. */
export async function importBackup(db: HayDayDB, data: BackupFile): Promise<void> {
  const tables = [db.farms, db.stock, db.orders, db.overrides, db.customItems]
  await db.transaction('rw', tables, async () => {
    await Promise.all(tables.map((t) => t.clear()))
    await db.farms.bulkPut(data.farms)
    await db.stock.bulkPut(data.stock)
    await db.orders.bulkPut(data.orders)
    await db.overrides.bulkPut(data.catalogOverrides)
    await db.customItems.bulkPut(data.customItems)
  })
}
