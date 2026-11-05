import { beforeEach, describe, expect, test } from 'vitest'
import {
  adjustCount, logBatch, markOrderDone, previewOrderDone, saveQuickCount, setCount, setMin,
} from '../../src/actions/stockActions'
import { createDb, type HayDayDB } from '../../src/data/db'
import { saveOrder } from '../../src/data/repo'
import { makeOrder, makeStock } from '../fixtures/builders'
import { testCatalog } from '../fixtures/testCatalog'

let db: HayDayDB
beforeEach(() => { db = createDb(crypto.randomUUID()) })

const total = async (itemId: string, farmId = 'main') => (await db.stock.get([farmId, itemId]))?.total

describe('markOrderDone', () => {
  test('deducts stock, floors at zero and reports the shortfall', async () => {
    await db.stock.bulkPut(makeStock('main', { wheat: 5 }))
    const order = makeOrder('main', { wheat: 7 })
    await saveOrder(db, order)

    expect(await previewOrderDone(db, order.id)).toEqual({ short: [{ itemId: 'wheat', qty: 2 }] })
    expect(await total('wheat')).toBe(5)

    expect(await markOrderDone(db, order.id)).toEqual({ short: [{ itemId: 'wheat', qty: 2 }] })
    expect(await total('wheat')).toBe(0)
    expect((await db.orders.get(order.id))?.status).toBe('done')
  })

  test('keeps the minimum when deducting', async () => {
    await db.stock.bulkPut(makeStock('main', { bread: { total: 3, min: 2 } }))
    const order = makeOrder('main', { bread: 1 })
    await saveOrder(db, order)
    expect(await markOrderDone(db, order.id)).toEqual({ short: [] })
    expect(await db.stock.get(['main', 'bread'])).toEqual({ farmId: 'main', itemId: 'bread', total: 2, min: 2 })
  })
})

test('marking the same order done twice deducts once', async () => {
  await db.stock.bulkPut(makeStock('main', { wheat: 10 }))
  const order = makeOrder('main', { wheat: 3 })
  await saveOrder(db, order)
  await Promise.all([markOrderDone(db, order.id), markOrderDone(db, order.id)])
  expect(await total('wheat')).toBe(7)
})

describe('logBatch', () => {
  test('adds the product and deducts ingredients', async () => {
    await db.stock.bulkPut(makeStock('main', { wheat: 4 }))
    expect(await logBatch(db, testCatalog, 'main', 'bread')).toEqual({ short: [] })
    expect(await total('bread')).toBe(1)
    expect(await total('wheat')).toBe(1)
  })

  test('reports ingredients that were short', async () => {
    await db.stock.bulkPut(makeStock('main', { wheat: 1 }))
    expect(await logBatch(db, testCatalog, 'main', 'bread')).toEqual({ short: [{ itemId: 'wheat', qty: 2 }] })
    expect(await total('wheat')).toBe(0)
  })

  test('a crop adds its net yield', async () => {
    await db.stock.bulkPut(makeStock('main', { wheat: 3 }))
    await logBatch(db, testCatalog, 'main', 'wheat')
    expect(await total('wheat')).toBe(4)
  })

  test('an unknown item is rejected', async () => {
    await expect(logBatch(db, testCatalog, 'main', 'ghost')).rejects.toThrow(Error)
  })
})

test('saveQuickCount writes all counts and keeps minimums', async () => {
  await db.stock.bulkPut(makeStock('main', { wheat: { total: 1, min: 5 } }))
  await saveQuickCount(db, 'main', { wheat: 9, corn: 4 })
  expect(await db.stock.get(['main', 'wheat'])).toEqual({ farmId: 'main', itemId: 'wheat', total: 9, min: 5 })
  expect(await total('corn')).toBe(4)
})

test('setCount, adjustCount and setMin', async () => {
  await setCount(db, 'main', 'wheat', 3)
  await adjustCount(db, 'main', 'wheat', 2)
  expect(await total('wheat')).toBe(5)
  await adjustCount(db, 'main', 'wheat', -10)
  expect(await total('wheat')).toBe(0)
  await setMin(db, 'main', 'wheat', 6)
  expect(await db.stock.get(['main', 'wheat'])).toEqual({ farmId: 'main', itemId: 'wheat', total: 0, min: 6 })
})
