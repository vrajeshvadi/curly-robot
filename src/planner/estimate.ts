import { ingredientsOf } from '../catalog/build'
import type { Catalog, Farm, ItemId, StockRow, Storage } from '../types'
import { resourceKey, type Breakdown, type ResourceKey } from './breakdown'

export type PlanWarning =
  | { kind: 'no-seed'; itemId: ItemId; have: number; need: number }
  | { kind: 'barn-overflow' | 'silo-overflow'; projected: number; capacity: number }
  | { kind: 'reserved-exceeds-total'; itemId: ItemId; reserved: number; total: number }

export interface TimeEstimate {
  perResource: Record<ResourceKey, number>
  overallMinutes: number
}

export function queueRefills(batches: number, slots: number): number {
  return Math.ceil(batches / slots)
}

/** Machines run one batch at a time; fields, animals and trees work in parallel rounds. */
export function estimateTime(b: Breakdown, catalog: Catalog, farm: Farm): TimeEstimate {
  const perResource: Record<ResourceKey, number> = {}
  const add = (k: ResourceKey, n: number) => { perResource[k] = (perResource[k] ?? 0) + n }

  for (const row of b.make) {
    const s = catalog.items[row.itemId].source
    if (s.kind === 'machine') add(row.resourceId, row.batches * s.minutes)
    else if (s.kind === 'animal') add(row.resourceId, Math.ceil(row.batches / farm.animals[s.animalId]) * s.minutes)
    else if (s.kind === 'tree') add(row.resourceId, Math.ceil(row.batches / farm.trees[s.treeId]) * s.minutes)
  }
  for (const row of b.plant) {
    const s = catalog.items[row.itemId].source
    if (s.kind === 'field') add(`field:${row.itemId}`, Math.ceil(row.plantings / farm.fields) * s.minutes)
  }

  const active = new Set<ItemId>([...b.make.map((m) => m.itemId), ...b.plant.map((p) => p.itemId)])
  const memo = new Map<ItemId, number>()
  const chain = (id: ItemId): number => {
    const hit = memo.get(id)
    if (hit !== undefined) return hit
    const item = catalog.items[id]
    const cost = perResource[resourceKey(item)!] ?? 0
    const below = ingredientsOf(item).filter((i) => active.has(i.itemId)).map((i) => chain(i.itemId))
    const v = cost + Math.max(0, ...below)
    memo.set(id, v)
    return v
  }
  const overallMinutes = Math.max(0, ...[...active].map(chain))
  return { perResource, overallMinutes }
}

/** Projected barn/silo use after making (before delivery) against capacity. */
export function checkStorage(b: Breakdown, catalog: Catalog, farm: Farm, stock: StockRow[]): PlanWarning[] {
  const used: Record<Storage, number> = { barn: 0, silo: 0 }
  const storageOf = (id: ItemId) => catalog.items[id]?.storage
  for (const r of stock) {
    const st = r.farmId === farm.id ? storageOf(r.itemId) : undefined
    if (st) used[st] += r.total
  }
  for (const [id, n] of Object.entries(b.produced)) { const st = storageOf(id); if (st) used[st] += n }
  for (const [id, n] of Object.entries(b.consumed)) { const st = storageOf(id); if (st) used[st] -= n }
  for (const t of b.transfers) { const st = storageOf(t.itemId); if (st) used[st] += t.qty }

  const out: PlanWarning[] = []
  if (used.barn > farm.barnCapacity) out.push({ kind: 'barn-overflow', projected: used.barn, capacity: farm.barnCapacity })
  if (used.silo > farm.siloCapacity) out.push({ kind: 'silo-overflow', projected: used.silo, capacity: farm.siloCapacity })
  return out
}
