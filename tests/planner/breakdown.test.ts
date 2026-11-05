import { describe, expect, test } from 'vitest'
import { breakdown, type Breakdown, type PlanInput } from '../../src/planner/breakdown'
import type { Order } from '../../src/types'
import { makeFarm, makeOrder, makeStock } from '../fixtures/builders'
import { cloneCatalog, testCatalog } from '../fixtures/testCatalog'

function input(p: Partial<PlanInput> & { orders?: Order[] }): PlanInput {
  const orders = p.orders ?? []
  return {
    catalog: testCatalog,
    targetFarmId: 'main',
    farms: [makeFarm()],
    stock: [],
    orderIds: orders.map((o) => o.id),
    topUps: [],
    useOtherFarms: true,
    ...p,
    orders,
  }
}

function run(p: Partial<PlanInput> & { orders?: Order[] }): Breakdown {
  const r = breakdown(input(p))
  if (!r.ok) throw new Error(`unexpected error ${r.error}`)
  return r.breakdown
}

const baby = (id: string, name: string, level = 20) => makeFarm({ id, name, level })

describe('breakdown', () => {
  test('1. makes bread from stock wheat, plants the rest and flags missing seed', () => {
    const b = run({ orders: [makeOrder('main', { bread: 2 })], stock: makeStock('main', { wheat: 1 }) })
    expect(b.make).toEqual([{ itemId: 'bread', batches: 2, resourceId: 'machine:bakery' }])
    expect(b.fromStock).toEqual([{ itemId: 'wheat', qty: 1 }])
    expect(b.plant).toEqual([{ itemId: 'wheat', plantings: 5 }])
    // The farm had 1 wheat to plant with before baking, so there is no seed warning.
    expect(b.noSeed).toEqual([])
    expect(b.transfers).toEqual([])
    expect(b.cantMakeHere).toEqual([])
    expect(b.missing).toEqual([])
    // 13. produced / consumed
    expect(b.produced).toEqual({ bread: 2, wheat: 10 })
    expect(b.consumed).toEqual({ wheat: 11 })
  })

  test('1b. no seed warning only when the farm has no seed at all', () => {
    const b = run({ orders: [makeOrder('main', { bread: 2 })] })
    expect(b.noSeed).toEqual([{ itemId: 'wheat', have: 0, need: 1 }])
  })

  test('2. shared ingredients are totalled before netting', () => {
    const b = run({
      orders: [makeOrder('main', { bread: 1 }), makeOrder('main', { cornbread: 1 })],
      stock: makeStock('main', { wheat: 10, corn: 10 }),
    })
    expect(b.make).toEqual([
      { itemId: 'bread', batches: 1, resourceId: 'machine:bakery' },
      { itemId: 'chicken_feed', batches: 1, resourceId: 'machine:feed_mill' },
      { itemId: 'cornbread', batches: 1, resourceId: 'machine:bakery' },
      { itemId: 'egg', batches: 2, resourceId: 'animal:chicken' },
    ])
    expect(b.fromStock).toEqual([{ itemId: 'corn', qty: 3 }, { itemId: 'wheat', qty: 5 }])
    expect(b.plant).toEqual([])
  })

  test('3. a shortfall is covered by another farm', () => {
    const b = run({
      orders: [makeOrder('main', { corn: 6 })],
      farms: [makeFarm(), baby('b1', 'Baby 1')],
      stock: makeStock('b1', { corn: { total: 14, min: 4 } }),
    })
    expect(b.transfers).toEqual([{ fromFarmId: 'b1', itemId: 'corn', qty: 6 }])
    expect(b.plant).toEqual([])
  })

  test("4. another farm's minimum is respected", () => {
    const b = run({
      orders: [makeOrder('main', { corn: 6 })],
      farms: [makeFarm(), baby('b1', 'Baby 1')],
      stock: makeStock('b1', { corn: { total: 8, min: 4 } }),
    })
    expect(b.transfers).toEqual([{ fromFarmId: 'b1', itemId: 'corn', qty: 4 }])
    expect(b.plant).toEqual([{ itemId: 'corn', plantings: 2 }])
  })

  test('5. the farm with the largest spare is used first', () => {
    const b = run({
      orders: [makeOrder('main', { corn: 6 })],
      farms: [makeFarm(), baby('bA', 'Baby A'), baby('bB', 'Baby B')],
      stock: [...makeStock('bA', { corn: 3 }), ...makeStock('bB', { corn: 5 })],
    })
    expect(b.transfers).toEqual([
      { fromFarmId: 'bB', itemId: 'corn', qty: 5 },
      { fromFarmId: 'bA', itemId: 'corn', qty: 1 },
    ])
  })

  test('6. finished goods are transferred before their ingredients', () => {
    const b = run({
      orders: [makeOrder('main', { bread: 2 })],
      farms: [makeFarm(), baby('b1', 'Baby 1')],
      stock: makeStock('b1', { bread: 2, wheat: 10 }),
    })
    expect(b.transfers).toEqual([{ fromFarmId: 'b1', itemId: 'bread', qty: 2 }])
    expect(b.make).toEqual([])
  })

  test('7. other farms are ignored when switched off', () => {
    const b = run({
      orders: [makeOrder('main', { corn: 6 })],
      farms: [makeFarm(), baby('b1', 'Baby 1')],
      stock: makeStock('b1', { corn: 14 }),
      useOtherFarms: false,
    })
    expect(b.transfers).toEqual([])
    expect(b.plant).toEqual([{ itemId: 'corn', plantings: 6 }])
  })

  test('8a. locked items go to cantMakeHere without expanding', () => {
    const b = run({ orders: [makeOrder('main', { blackberry_muffin: 1 })] })
    expect(b.cantMakeHere).toEqual([{ itemId: 'blackberry_muffin', qty: 1 }])
    expect(b.plant).toEqual([])
    expect(b.make).toEqual([])
  })

  test('8b. a locked item can come from a higher-level farm', () => {
    const b = run({
      orders: [makeOrder('main', { blackberry_muffin: 1 })],
      farms: [makeFarm(), baby('b1', 'Baby 1', 45)],
      stock: makeStock('b1', { blackberry_muffin: 1 }),
    })
    expect(b.transfers).toEqual([{ fromFarmId: 'b1', itemId: 'blackberry_muffin', qty: 1 }])
    expect(b.cantMakeHere).toEqual([])
  })

  describe('9. reservations', () => {
    const a = makeOrder('main', { wheat: 3 }, { reserve: true })
    const bOrder = makeOrder('main', { wheat: 4 })
    const stock = makeStock('main', { wheat: 5 })

    test('stock reserved by an order outside the plan is not used', () => {
      const b = run({ orders: [a, bOrder], orderIds: [bOrder.id], stock })
      expect(b.fromStock).toEqual([{ itemId: 'wheat', qty: 2 }])
      expect(b.plant).toEqual([{ itemId: 'wheat', plantings: 2 }])
    })

    test('a reserved order inside the plan uses its reservation', () => {
      const b = run({ orders: [a, bOrder], stock })
      expect(b.fromStock).toEqual([{ itemId: 'wheat', qty: 5 }])
      expect(b.plant).toEqual([{ itemId: 'wheat', plantings: 2 }])
    })
  })

  test('10. top-ups bring low stock up to its minimum', () => {
    const b = run({ stock: makeStock('main', { wheat: { total: 1, min: 5 } }), topUps: ['wheat'] })
    expect(b.plant).toEqual([{ itemId: 'wheat', plantings: 4 }])
  })

  test('10b. a top-up on stock that is not low adds nothing', () => {
    const b = run({ stock: makeStock('main', { wheat: { total: 6, min: 5 } }), topUps: ['wheat'] })
    expect(b.plant).toEqual([])
    expect(b.fromStock).toEqual([])
  })

  test('11. materials and unknown items are missing', () => {
    const b = run({ orders: [makeOrder('main', { bolt: 2, ghost: 1 })] })
    expect(b.missing).toEqual([{ itemId: 'bolt', qty: 2 }, { itemId: 'ghost', qty: 1 }])
  })

  test('12. a recipe loop returns an error', () => {
    const c = cloneCatalog()
    c.items.wheat = { ...c.items.wheat, source: { kind: 'machine', machineId: 'bakery', yield: 1, minutes: 1,
      ingredients: [{ itemId: 'bread', qty: 1 }] } }
    expect(breakdown(input({ catalog: c, orders: [makeOrder('main', { bread: 1 })] }))).toEqual({
      ok: false, error: 'cycle',
    })
  })
})
