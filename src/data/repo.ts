import { usedIn } from '../catalog/validate'
import type { Catalog, CatalogOverride, CustomItem, Farm, FarmId, Ingredient, ItemId, Order, StockRow } from '../types'
import type { HayDayDB } from './db'

export async function listFarms(db: HayDayDB): Promise<Farm[]> {
  return (await db.farms.toArray()).sort((a, b) => a.name.localeCompare(b.name))
}

export async function saveFarm(db: HayDayDB, farm: Farm): Promise<void> {
  await db.farms.put(farm)
}

/** Deletes the farm together with its stock rows and orders, in one transaction. */
export async function deleteFarm(db: HayDayDB, farmId: FarmId): Promise<void> {
  await db.transaction('rw', db.farms, db.stock, db.orders, async () => {
    await db.stock.where('farmId').equals(farmId).delete()
    await db.orders.where('farmId').equals(farmId).delete()
    await db.farms.delete(farmId)
  })
}

export async function listStock(db: HayDayDB): Promise<StockRow[]> {
  return db.stock.toArray()
}

export async function listOrders(db: HayDayDB): Promise<Order[]> {
  return (await db.orders.toArray()).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/** Merges duplicate item IDs (first-seen order) and drops lines with qty ≤ 0. */
export function normalizeLines(lines: Ingredient[]): Ingredient[] {
  const merged = new Map<ItemId, number>()
  for (const l of lines) if (l.qty > 0) merged.set(l.itemId, (merged.get(l.itemId) ?? 0) + l.qty)
  return [...merged].map(([itemId, qty]) => ({ itemId, qty }))
}

export async function saveOrder(db: HayDayDB, order: Order): Promise<void> {
  await db.orders.put({ ...order, lines: normalizeLines(order.lines) })
}

export async function deleteOrder(db: HayDayDB, orderId: string): Promise<void> {
  await db.orders.delete(orderId)
}

export async function saveOverride(db: HayDayDB, o: CatalogOverride): Promise<void> {
  await db.overrides.put(o)
}

export async function deleteOverride(db: HayDayDB, itemId: ItemId): Promise<void> {
  await db.overrides.delete(itemId)
}

export async function saveCustomItem(db: HayDayDB, item: CustomItem): Promise<void> {
  await db.customItems.put(item)
}

export type DeleteCustomResult = { ok: true } | { ok: false; reason: 'used-in-recipe' | 'in-orders' | 'in-stock' }

export async function deleteCustomItem(db: HayDayDB, catalog: Catalog, itemId: ItemId): Promise<DeleteCustomResult> {
  return db.transaction('rw', db.customItems, db.orders, db.stock, async () => {
    if (usedIn(catalog, itemId).length > 0) return { ok: false, reason: 'used-in-recipe' } as const
    const open = await db.orders.where('status').equals('open').toArray()
    if (open.some((o) => o.lines.some((l) => l.itemId === itemId))) return { ok: false, reason: 'in-orders' } as const
    const rows = await db.stock.where('itemId').equals(itemId).toArray()
    if (rows.some((r) => r.total > 0)) return { ok: false, reason: 'in-stock' } as const
    await db.stock.where('itemId').equals(itemId).delete()
    await db.customItems.delete(itemId)
    return { ok: true } as const
  })
}

export async function getMeta<T>(db: HayDayDB, key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined
}

export async function setMeta(db: HayDayDB, key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}
