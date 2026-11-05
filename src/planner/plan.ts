import type { Catalog, Farm, ItemId, Order, StockRow } from '../types'
import { breakdown, type Breakdown, type PlanInput, type ResourceKey } from './breakdown'
import { checkStorage, estimateTime, queueRefills, type PlanWarning, type TimeEstimate } from './estimate'
import { levelOf, stockLevels } from './stock'

export interface PlanMakeRow {
  itemId: ItemId
  batches: number
  resourceId: ResourceKey
  /** Times the machine queue must be filled; null for animals and trees. */
  queueRefills: number | null
}

export interface Plan extends Omit<Breakdown, 'make' | 'noSeed' | 'produced' | 'consumed'> {
  make: PlanMakeRow[]
  warnings: PlanWarning[]
  time: TimeEstimate
}

export type PlanResult = { ok: true; plan: Plan } | { ok: false; error: 'cycle' }

export function plan(input: PlanInput): PlanResult {
  const r = breakdown(input)
  if (!r.ok) return r
  const b = r.breakdown
  const { catalog } = input
  const farm = input.farms.find((f) => f.id === input.targetFarmId)!

  const make = b.make.map((m) => {
    const s = catalog.items[m.itemId].source
    const slots = s.kind === 'machine' ? farm.machines[s.machineId]?.slots : undefined
    return { ...m, queueRefills: slots ? queueRefills(m.batches, slots) : null }
  })

  const warnings: PlanWarning[] = b.noSeed.map((n) => ({ kind: 'no-seed' as const, ...n }))

  const demanded = new Set<ItemId>([...input.topUps, ...(input.extraDemand ?? []).map((l) => l.itemId)])
  const chosen = new Set(input.orderIds)
  for (const o of input.orders) if (chosen.has(o.id)) for (const l of o.lines) demanded.add(l.itemId)
  const levels = stockLevels(farm.id, input.stock, input.orders)
  for (const id of demanded) {
    const lv = levelOf(levels, id)
    if (lv.reserved > lv.total) warnings.push({ kind: 'reserved-exceeds-total', itemId: id, reserved: lv.reserved, total: lv.total })
  }
  warnings.push(...checkStorage(b, catalog, farm, input.stock))

  const { fromStock, transfers, plant, cantMakeHere, missing } = b
  return {
    ok: true,
    plan: { fromStock, transfers, make, plant, cantMakeHere, missing, warnings, time: estimateTime(b, catalog, farm) },
  }
}

/** Ingredient calculator: one item and quantity, against empty stock or this farm's own stock. */
export function calculate(
  catalog: Catalog,
  farm: Farm,
  itemId: ItemId,
  qty: number,
  mode: 'empty' | 'mine',
  data: { farms: Farm[]; stock: StockRow[]; orders: Order[] },
): PlanResult {
  return plan({
    catalog,
    targetFarmId: farm.id,
    farms: [farm],
    stock: mode === 'empty' ? [] : data.stock.filter((s) => s.farmId === farm.id),
    orders: mode === 'empty' ? [] : data.orders.filter((o) => o.farmId === farm.id),
    orderIds: [],
    topUps: [],
    extraDemand: [{ itemId, qty }],
    useOtherFarms: false,
  })
}
