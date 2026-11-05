import { describe, expect, test } from 'vitest'
import { breakdown, type Breakdown, type PlanInput } from '../../src/planner/breakdown'
import { checkStorage, estimateTime, queueRefills } from '../../src/planner/estimate'
import type { Farm, Order } from '../../src/types'
import { makeFarm, makeOrder, makeStock } from '../fixtures/builders'
import { testCatalog } from '../fixtures/testCatalog'

function bd(p: Partial<PlanInput> & { orders: Order[]; farm?: Farm }): Breakdown {
  const farm = p.farm ?? makeFarm()
  const r = breakdown({
    catalog: testCatalog, targetFarmId: farm.id, farms: [farm], stock: [], topUps: [],
    useOtherFarms: true, orderIds: p.orders.map((o) => o.id), ...p,
  })
  if (!r.ok) throw new Error('cycle')
  return r.breakdown
}

describe('estimateTime', () => {
  test('fields run in parallel rounds, machines one batch at a time, overall follows the chain', () => {
    const farm = makeFarm({ fields: 2 })
    const b = bd({ farm, orders: [makeOrder('main', { bread: 2 })], stock: makeStock('main', { wheat: 1 }) })
    const t = estimateTime(b, testCatalog, farm)
    expect(t.perResource['field:wheat']).toBe(6)
    expect(t.perResource['machine:bakery']).toBe(10)
    expect(t.overallMinutes).toBe(16)
  })

  test('animals work in parallel', () => {
    const farm = makeFarm()
    const feed = makeStock('main', { chicken_feed: 10 })
    expect(estimateTime(bd({ farm, orders: [makeOrder('main', { egg: 2 })], stock: feed }), testCatalog, farm)
      .perResource['animal:chicken']).toBe(20)
    expect(estimateTime(bd({ farm, orders: [makeOrder('main', { egg: 7 })], stock: feed }), testCatalog, farm)
      .perResource['animal:chicken']).toBe(40)
  })

  test('overall is the longest chain, not the sum of all resources', () => {
    const farm = makeFarm()
    const b = bd({ farm, orders: [makeOrder('main', { bread: 1, apple: 1 })], stock: makeStock('main', { wheat: 10 }) })
    expect(estimateTime(b, testCatalog, farm).overallMinutes).toBe(60)
  })

  test('nothing to make takes no time', () => {
    const farm = makeFarm()
    const b = bd({ farm, orders: [makeOrder('main', { bread: 1 })], stock: makeStock('main', { bread: 1 }) })
    expect(estimateTime(b, testCatalog, farm)).toEqual({ perResource: {}, overallMinutes: 0 })
  })
})

describe('checkStorage', () => {
  test('warns when finished goods would overflow the barn', () => {
    const farm = makeFarm({ barnCapacity: 9 })
    const stock = makeStock('main', { bolt: 8, wheat: 6 })
    const b = bd({ farm, orders: [makeOrder('main', { bread: 2 })], stock })
    expect(checkStorage(b, testCatalog, farm, stock)).toEqual([
      { kind: 'barn-overflow', projected: 10, capacity: 9 },
    ])
  })

  test('transfers in count toward projected storage', () => {
    const farm = makeFarm({ barnCapacity: 9 })
    const baby = makeFarm({ id: 'b1', name: 'Baby 1' })
    const stock = [...makeStock('main', { bolt: 8 }), ...makeStock('b1', { bread: 2 })]
    const b = bd({ farm, farms: [farm, baby], orders: [makeOrder('main', { bread: 2 })], stock })
    expect(checkStorage(b, testCatalog, farm, stock)).toEqual([
      { kind: 'barn-overflow', projected: 10, capacity: 9 },
    ])
  })

  test('no warning when everything fits', () => {
    const farm = makeFarm()
    const stock = makeStock('main', { wheat: 6 })
    const b = bd({ farm, orders: [makeOrder('main', { bread: 2 })], stock })
    expect(checkStorage(b, testCatalog, farm, stock)).toEqual([])
  })
})

test('queueRefills rounds up', () => {
  expect(queueRefills(5, 2)).toBe(3)
  expect(queueRefills(2, 2)).toBe(1)
})
