import type { Catalog, Farm, FarmId, Item, ItemId, Order, StockRow } from '../types'

export interface StockLevel {
  total: number
  reserved: number
  free: number
  spare: number
  min: number
  low: boolean
}

const ZERO: StockLevel = { total: 0, reserved: 0, free: 0, spare: 0, min: 0, low: false }

function toLevel(total: number, min: number, reserved: number): StockLevel {
  const free = Math.max(0, total - reserved)
  return { total, reserved, free, spare: Math.max(0, free - min), min, low: min > 0 && free < min }
}

/**
 * Stock levels for one farm. Reservations come from open orders on that farm with `reserve` on,
 * except those listed in `excludeOrderIds`.
 */
export function stockLevels(
  farmId: FarmId,
  stock: StockRow[],
  orders: Order[],
  excludeOrderIds?: Set<string>,
): Map<ItemId, StockLevel> {
  const reserved = new Map<ItemId, number>()
  for (const o of orders) {
    if (o.farmId !== farmId || o.status !== 'open' || !o.reserve || excludeOrderIds?.has(o.id)) continue
    for (const l of o.lines) reserved.set(l.itemId, (reserved.get(l.itemId) ?? 0) + l.qty)
  }

  const rows = new Map<ItemId, { total: number; min: number }>()
  for (const r of stock) if (r.farmId === farmId) rows.set(r.itemId, { total: r.total, min: r.min })

  const levels = new Map<ItemId, StockLevel>()
  for (const id of new Set([...rows.keys(), ...reserved.keys()])) {
    const row = rows.get(id) ?? { total: 0, min: 0 }
    levels.set(id, toLevel(row.total, row.min, reserved.get(id) ?? 0))
  }
  return levels
}

export function levelOf(levels: Map<ItemId, StockLevel>, itemId: ItemId): StockLevel {
  return levels.get(itemId) ?? ZERO
}

/** Locked when above the farm's level, or when the farm has none of the resource that makes it. */
export function isLocked(item: Item, farm: Farm, catalog: Catalog): boolean {
  if (item.unlockLevel > farm.level) return true
  const s = item.source
  switch (s.kind) {
    case 'machine': {
      const m = farm.machines[s.machineId]
      const known = catalog.machines[s.machineId]
      return !known || !m || !m.owned || m.slots <= 0
    }
    case 'field':
      return !(farm.fields > 0)
    case 'animal':
      return !(farm.animals[s.animalId] > 0)
    case 'tree':
      return !(farm.trees[s.treeId] > 0)
    case 'none':
      return false
  }
}

/** True when every line fits in stock available to this order (its own reservation counts as available). */
export function canFillNow(order: Order, stock: StockRow[], orders: Order[]): boolean {
  const levels = stockLevels(order.farmId, stock, orders, new Set([order.id]))
  const need = new Map<ItemId, number>()
  for (const l of order.lines) need.set(l.itemId, (need.get(l.itemId) ?? 0) + l.qty)
  return [...need].every(([id, qty]) => qty <= levelOf(levels, id).free)
}
