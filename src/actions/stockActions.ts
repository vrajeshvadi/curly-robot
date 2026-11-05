import { ingredientsOf } from '../catalog/build'
import type { HayDayDB } from '../data/db'
import type { Catalog, FarmId, Ingredient, ItemId, StockRow } from '../types'

/** Items whose deduction was floored at zero, and by how much. */
export type ShortReport = { short: Ingredient[] }

async function row(db: HayDayDB, farmId: FarmId, itemId: ItemId): Promise<StockRow> {
  return (await db.stock.get([farmId, itemId])) ?? { farmId, itemId, total: 0, min: 0 }
}

/** Applies signed changes to one farm's stock, flooring at zero. Must run inside a transaction. */
async function applyChanges(db: HayDayDB, farmId: FarmId, changes: Ingredient[], write: boolean): Promise<ShortReport> {
  const short: Ingredient[] = []
  const next = new Map<ItemId, StockRow>()
  for (const c of changes) {
    const r = next.get(c.itemId) ?? (await row(db, farmId, c.itemId))
    const total = r.total + c.qty
    if (total < 0) short.push({ itemId: c.itemId, qty: -total })
    next.set(c.itemId, { ...r, total: Math.max(0, total) })
  }
  if (write) await db.stock.bulkPut([...next.values()])
  return { short }
}

async function orderChanges(db: HayDayDB, orderId: string) {
  const order = await db.orders.get(orderId)
  if (!order) throw new Error(`Unknown order ${orderId}`)
  return { order, changes: order.lines.map((l) => ({ itemId: l.itemId, qty: -l.qty })) }
}

export async function previewOrderDone(db: HayDayDB, orderId: string): Promise<ShortReport> {
  return db.transaction('r', db.orders, db.stock, async () => {
    const { order, changes } = await orderChanges(db, orderId)
    return applyChanges(db, order.farmId, changes, false)
  })
}

/** Deducts the order's lines and marks it done; its reservation disappears with it. */
export async function markOrderDone(db: HayDayDB, orderId: string): Promise<ShortReport> {
  return db.transaction('rw', db.orders, db.stock, async () => {
    const { order, changes } = await orderChanges(db, orderId)
    if (order.status === 'done') return { short: [] } // already done, e.g. a double tap
    const report = await applyChanges(db, order.farmId, changes, true)
    await db.orders.put({ ...order, status: 'done' })
    return report
  })
}

/** "Made 1 batch": adds the product's yield (net yield for crops) and deducts its ingredients. */
export async function logBatch(db: HayDayDB, catalog: Catalog, farmId: FarmId, itemId: ItemId): Promise<ShortReport> {
  const item = catalog.items[itemId]
  if (!item) throw new Error(`Unknown item ${itemId}`)
  const s = item.source
  if (s.kind === 'none') throw new Error(`${item.name} cannot be produced`)
  const gain = s.kind === 'field' ? s.harvestYield - s.seedUsed : s.yield
  const changes = [{ itemId, qty: gain }, ...ingredientsOf(item).map((i) => ({ itemId: i.itemId, qty: -i.qty }))]
  return db.transaction('rw', db.stock, () => applyChanges(db, farmId, changes, true))
}

/** Writes all counts at once, keeping each item's minimum. */
export async function saveQuickCount(db: HayDayDB, farmId: FarmId, counts: Record<ItemId, number>): Promise<void> {
  await db.transaction('rw', db.stock, async () => {
    const rows = await Promise.all(
      Object.entries(counts).map(async ([itemId, total]) => ({ ...(await row(db, farmId, itemId)), total })),
    )
    await db.stock.bulkPut(rows)
  })
}

export async function setCount(db: HayDayDB, farmId: FarmId, itemId: ItemId, total: number): Promise<void> {
  await saveQuickCount(db, farmId, { [itemId]: Math.max(0, total) })
}

export async function adjustCount(db: HayDayDB, farmId: FarmId, itemId: ItemId, delta: number): Promise<void> {
  await db.transaction('rw', db.stock, () => applyChanges(db, farmId, [{ itemId, qty: delta }], true))
}

export async function setMin(db: HayDayDB, farmId: FarmId, itemId: ItemId, min: number): Promise<void> {
  await db.transaction('rw', db.stock, async () => {
    await db.stock.put({ ...(await row(db, farmId, itemId)), min: Math.max(0, min) })
  })
}
