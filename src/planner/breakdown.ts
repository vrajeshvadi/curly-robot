import { ingredientsOf } from '../catalog/build'
import type { Catalog, Farm, FarmId, Ingredient, Item, ItemId, Order, StockRow } from '../types'
import { isLocked, levelOf, stockLevels } from './stock'

export interface PlanInput {
  catalog: Catalog
  targetFarmId: FarmId
  farms: Farm[]
  stock: StockRow[]
  orders: Order[]
  orderIds: string[]
  topUps: ItemId[]
  extraDemand?: Ingredient[]
  useOtherFarms: boolean
}

/** "machine:<id>" | "field:<itemId>" | "animal:<id>" | "tree:<id>" */
export type ResourceKey = string

export interface Transfer {
  fromFarmId: FarmId
  itemId: ItemId
  qty: number
}

export interface MakeRow {
  itemId: ItemId
  batches: number
  resourceId: ResourceKey
}

export interface Breakdown {
  fromStock: Ingredient[]
  transfers: Transfer[]
  make: MakeRow[]
  plant: { itemId: ItemId; plantings: number }[]
  cantMakeHere: Ingredient[]
  missing: Ingredient[]
  noSeed: { itemId: ItemId; have: number; need: number }[]
  produced: Record<ItemId, number>
  consumed: Record<ItemId, number>
}

export type BreakdownResult = { ok: true; breakdown: Breakdown } | { ok: false; error: 'cycle' }

export function resourceKey(item: Item): ResourceKey | null {
  const s = item.source
  switch (s.kind) {
    case 'machine': return `machine:${s.machineId}`
    case 'animal': return `animal:${s.animalId}`
    case 'tree': return `tree:${s.treeId}`
    case 'field': return `field:${item.id}`
    case 'none': return null
  }
}

/** Items reachable from `roots`, parents before ingredients. Returns null on a recipe loop. */
function topoOrder(catalog: Catalog, roots: ItemId[]): ItemId[] | null {
  const state = new Map<ItemId, 'visiting' | 'done'>()
  const post: ItemId[] = []
  let loop = false
  const visit = (id: ItemId) => {
    if (loop) return
    const st = state.get(id)
    if (st === 'done') return
    if (st === 'visiting') { loop = true; return }
    state.set(id, 'visiting')
    const item = catalog.items[id]
    if (item) for (const ing of ingredientsOf(item)) visit(ing.itemId)
    state.set(id, 'done')
    post.push(id)
  }
  for (const r of roots) visit(r)
  return loop ? null : post.reverse()
}

export function breakdown(input: PlanInput): BreakdownResult {
  const { catalog, targetFarmId, farms, stock, orders } = input
  const target = farms.find((f) => f.id === targetFarmId)
  if (!target) throw new Error(`Unknown farm ${targetFarmId}`)

  const add = (rec: Map<ItemId, number> | Record<ItemId, number>, id: ItemId, n: number) => {
    if (n <= 0) return
    if (rec instanceof Map) rec.set(id, (rec.get(id) ?? 0) + n)
    else rec[id] = (rec[id] ?? 0) + n
  }

  // 1. Demand
  const demand = new Map<ItemId, number>()
  const inPlan = new Set(input.orderIds)
  for (const o of orders) {
    if (!inPlan.has(o.id) || o.farmId !== targetFarmId || o.status !== 'open') continue
    for (const l of o.lines) add(demand, l.itemId, l.qty)
  }
  const plainLevels = stockLevels(targetFarmId, stock, orders)
  for (const id of input.topUps) {
    const lv = levelOf(plainLevels, id)
    // Adding min (not min − free): netting against free stock below leaves exactly min − free to make.
    if (lv.low) add(demand, id, lv.min)
  }
  for (const l of input.extraDemand ?? []) add(demand, l.itemId, l.qty)

  // 2. Available stock on the target farm, and spare on the others
  const targetLevels = stockLevels(targetFarmId, stock, orders, inPlan)
  const avail = new Map<ItemId, number>()
  const availOf = (id: ItemId) => avail.get(id) ?? levelOf(targetLevels, id).free
  const others = input.useOtherFarms ? farms.filter((f) => f.id !== targetFarmId) : []
  const spare = new Map(others.map((f) => [f.id, stockLevels(f.id, stock, orders)]))
  const spareUsed = new Map<string, number>()
  const spareOf = (farmId: FarmId, id: ItemId) =>
    levelOf(spare.get(farmId)!, id).spare - (spareUsed.get(`${farmId}|${id}`) ?? 0)

  const order = topoOrder(catalog, [...demand.keys()])
  if (!order) return { ok: false, error: 'cycle' }

  const fromStock = new Map<ItemId, number>()
  const transfers: Transfer[] = []
  const make: MakeRow[] = []
  const plant: { itemId: ItemId; plantings: number }[] = []
  const cantMakeHere = new Map<ItemId, number>()
  const missing = new Map<ItemId, number>()
  const noSeed: Breakdown['noSeed'] = []
  const produced: Record<ItemId, number> = {}
  const consumed: Record<ItemId, number> = {}

  // 3. Process items top-down
  for (const id of order) {
    let need = demand.get(id) ?? 0
    if (need <= 0) continue

    // Seed for the first planting comes from stock before it is used up.
    const before = availOf(id)
    const take = Math.min(need, availOf(id))
    avail.set(id, availOf(id) - take)
    add(fromStock, id, take)
    need -= take

    if (need > 0 && others.length) {
      const byspare = [...others].sort(
        (a, b) => spareOf(b.id, id) - spareOf(a.id, id) || a.name.localeCompare(b.name),
      )
      for (const f of byspare) {
        if (need <= 0) break
        const t = Math.min(need, spareOf(f.id, id))
        if (t <= 0) continue
        spareUsed.set(`${f.id}|${id}`, (spareUsed.get(`${f.id}|${id}`) ?? 0) + t)
        transfers.push({ fromFarmId: f.id, itemId: id, qty: t })
        need -= t
      }
    }
    if (need <= 0) continue

    const item = catalog.items[id]
    if (!item || item.source.kind === 'none') { add(missing, id, need); continue }
    if (isLocked(item, target, catalog)) { add(cantMakeHere, id, need); continue }

    const s = item.source
    if (s.kind === 'field') {
      const plantings = Math.ceil(need / (s.harvestYield - s.seedUsed))
      plant.push({ itemId: id, plantings })
      add(produced, id, plantings * s.harvestYield)
      add(consumed, id, plantings * s.seedUsed)
      if (before < s.seedUsed) noSeed.push({ itemId: id, have: before, need: s.seedUsed })
      continue
    }

    const batches = Math.ceil(need / s.yield)
    make.push({ itemId: id, batches, resourceId: resourceKey(item)! })
    add(produced, id, batches * s.yield)
    for (const ing of ingredientsOf(item)) {
      add(demand, ing.itemId, ing.qty * batches)
      add(consumed, ing.itemId, ing.qty * batches)
    }
  }

  const nameOf = (id: ItemId) => catalog.items[id]?.name ?? id
  const byName = <T extends { itemId: ItemId }>(xs: T[]) => xs.sort((a, b) => nameOf(a.itemId).localeCompare(nameOf(b.itemId)))
  const toLines = (m: Map<ItemId, number>) => byName([...m].map(([itemId, qty]) => ({ itemId, qty })))

  return {
    ok: true,
    breakdown: {
      fromStock: toLines(fromStock),
      transfers: transfers.sort((a, b) => nameOf(a.itemId).localeCompare(nameOf(b.itemId)) || b.qty - a.qty),
      make: byName(make),
      plant: byName(plant),
      cantMakeHere: toLines(cantMakeHere),
      missing: toLines(missing),
      noSeed: byName(noSeed),
      produced,
      consumed,
    },
  }
}
