import { describe, expect, test } from 'vitest'
import { calculate, plan } from '../../src/planner/plan'
import { makeFarm, makeOrder, makeStock } from '../fixtures/builders'
import { testCatalog } from '../fixtures/testCatalog'

const base = { catalog: testCatalog, targetFarmId: 'main', topUps: [], useOtherFarms: true }

describe('plan', () => {
  test('adds queue refills for machine rows and no-seed warnings', () => {
    const farm = makeFarm({ fields: 2 })
    const order = makeOrder('main', { bread: 5, egg: 1 })
    const r = plan({ ...base, farms: [farm], stock: makeStock('main', { chicken_feed: 1 }),
      orders: [order], orderIds: [order.id] })
    if (!r.ok) throw new Error('cycle')
    expect(r.plan.make).toEqual([
      { itemId: 'bread', batches: 5, resourceId: 'machine:bakery', queueRefills: 3 },
      { itemId: 'egg', batches: 1, resourceId: 'animal:chicken', queueRefills: null },
    ])
    expect(r.plan.warnings).toContainEqual({ kind: 'no-seed', itemId: 'wheat', have: 0, need: 1 })
    expect(r.plan.time.overallMinutes).toBeGreaterThan(0)
  })

  test('warns when reserved stock exceeds the total', () => {
    const order = makeOrder('main', { wheat: 7 }, { reserve: true })
    const r = plan({ ...base, farms: [makeFarm()], stock: makeStock('main', { wheat: 5 }),
      orders: [order], orderIds: [order.id] })
    if (!r.ok) throw new Error('cycle')
    expect(r.plan.warnings).toContainEqual({ kind: 'reserved-exceeds-total', itemId: 'wheat', reserved: 7, total: 5 })
  })

  test('top-up with an order makes enough for both', () => {
    const order = makeOrder('main', { wheat: 2 })
    const r = plan({ ...base, farms: [makeFarm()], stock: makeStock('main', { wheat: { total: 1, min: 5 } }),
      orders: [order], orderIds: [order.id], topUps: ['wheat'] })
    if (!r.ok) throw new Error('cycle')
    expect(r.plan.plant).toEqual([{ itemId: 'wheat', plantings: 6 }])
  })
})

describe('calculate', () => {
  const farm = makeFarm()
  const baby = makeFarm({ id: 'b1', name: 'Baby 1' })
  const data = {
    farms: [farm, baby],
    stock: [...makeStock('main', { wheat: 150 }), ...makeStock('b1', { bread: 50 })],
    orders: [],
  }

  test('empty stock ignores every farm', () => {
    const r = calculate(testCatalog, farm, 'bread', 50, 'empty', data)
    if (!r.ok) throw new Error('cycle')
    expect(r.plan.make).toEqual([{ itemId: 'bread', batches: 50, resourceId: 'machine:bakery', queueRefills: 25 }])
    expect(r.plan.plant).toEqual([{ itemId: 'wheat', plantings: 150 }])
    expect(r.plan.transfers).toEqual([])
  })

  test('my stock uses this farm only', () => {
    const r = calculate(testCatalog, farm, 'bread', 50, 'mine', data)
    if (!r.ok) throw new Error('cycle')
    expect(r.plan.plant).toEqual([])
    expect(r.plan.transfers).toEqual([])
    expect(r.plan.fromStock).toEqual([{ itemId: 'wheat', qty: 150 }])
  })
})
