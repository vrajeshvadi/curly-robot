import { describe, expect, test } from 'vitest'
import { canFillNow, isLocked, levelOf, stockLevels } from '../../src/planner/stock'
import { makeFarm, makeOrder, makeStock } from '../fixtures/builders'
import { testCatalog } from '../fixtures/testCatalog'

const items = testCatalog.items

describe('stockLevels', () => {
  const stock = makeStock('main', { wheat: { total: 5, min: 3 } })
  const reserved = makeOrder('main', { wheat: 4 }, { reserve: true })

  test('reserved stock reduces free and spare', () => {
    const lv = levelOf(stockLevels('main', stock, [reserved]), 'wheat')
    expect(lv).toEqual({ total: 5, reserved: 4, free: 1, spare: 0, min: 3, low: true })
  })

  test('excluded orders do not reserve', () => {
    const lv = levelOf(stockLevels('main', stock, [reserved], new Set([reserved.id])), 'wheat')
    expect(lv).toEqual({ total: 5, reserved: 0, free: 5, spare: 2, min: 3, low: false })
  })

  test('free is never negative', () => {
    const big = makeOrder('main', { wheat: 7 }, { reserve: true })
    expect(levelOf(stockLevels('main', stock, [big]), 'wheat').free).toBe(0)
  })

  test('done orders, unreserved orders and other farms do not reserve', () => {
    const orders = [
      makeOrder('main', { wheat: 4 }, { reserve: true, status: 'done' }),
      makeOrder('main', { wheat: 4 }),
      makeOrder('b1', { wheat: 4 }, { reserve: true }),
    ]
    expect(levelOf(stockLevels('main', stock, orders), 'wheat').reserved).toBe(0)
  })

  test('items with no stock row are all zeros', () => {
    expect(levelOf(stockLevels('main', stock, []), 'corn')).toEqual({
      total: 0, reserved: 0, free: 0, spare: 0, min: 0, low: false,
    })
  })

  test('only rows for the farm are counted', () => {
    const lv = levelOf(stockLevels('main', makeStock('b1', { wheat: 9 }), []), 'wheat')
    expect(lv.total).toBe(0)
  })
})

describe('isLocked', () => {
  const farm = makeFarm()
  test.each([
    ['item above farm level', items.blackberry_muffin, farm],
    ['machine not owned', items.bread, makeFarm({ machines: { bakery: { owned: false, slots: 2 } } })],
    ['no fields', items.wheat, makeFarm({ fields: 0 })],
    ['no chickens', items.egg, makeFarm({ animals: { chicken: 0 } })],
    ['no apple trees', items.apple, makeFarm({ trees: {} })],
  ])('locked: %s', (_l, item, f) => {
    expect(isLocked(item, f, testCatalog)).toBe(true)
  })

  test.each([
    ['bread on default farm', items.bread],
    ['material', items.bolt],
  ])('unlocked: %s', (_l, item) => {
    expect(isLocked(item, farm, testCatalog)).toBe(false)
  })
})

describe('canFillNow', () => {
  const stock = makeStock('main', { wheat: 5 })
  const reserved = makeOrder('main', { wheat: 4 }, { reserve: true })
  const other = makeOrder('main', { wheat: 2 })

  test('a reserved order can use its own reservation', () => {
    expect(canFillNow(reserved, stock, [reserved, other])).toBe(true)
  })

  test('another order only sees free stock', () => {
    expect(canFillNow(other, stock, [reserved, other])).toBe(false)
  })
})
