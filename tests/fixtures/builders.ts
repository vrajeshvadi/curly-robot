import type { Farm, FarmId, ItemId, Order, StockRow } from '../../src/types'

export function makeFarm(overrides: Partial<Farm> = {}): Farm {
  return {
    id: 'main',
    name: 'Main',
    level: 20,
    barnCapacity: 100,
    siloCapacity: 100,
    fields: 10,
    machines: {
      feed_mill: { owned: true, slots: 2 },
      bakery: { owned: true, slots: 2 },
    },
    animals: { chicken: 6 },
    trees: { apple_tree: 2 },
    ...overrides,
  }
}

export function makeStock(
  farmId: FarmId,
  rows: Record<ItemId, number | { total: number; min: number }>,
): StockRow[] {
  return Object.entries(rows).map(([itemId, v]) =>
    typeof v === 'number'
      ? { farmId, itemId, total: v, min: 0 }
      : { farmId, itemId, total: v.total, min: v.min },
  )
}

let orderSeq = 0
export function makeOrder(
  farmId: FarmId,
  lines: Record<ItemId, number>,
  opts: Partial<Order> = {},
): Order {
  orderSeq += 1
  return {
    id: `order-${orderSeq}`,
    farmId,
    type: 'truck',
    lines: Object.entries(lines).map(([itemId, qty]) => ({ itemId, qty })),
    reserve: false,
    status: 'open',
    createdAt: '2026-11-05T00:00:00.000Z',
    ...opts,
  }
}
