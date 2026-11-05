import { beforeEach, describe, expect, test } from 'vitest'
import { createDb, type HayDayDB } from '../../src/data/db'
import {
  deleteCustomItem, deleteFarm, getMeta, listFarms, listOrders, listStock, normalizeLines,
  saveCustomItem, saveFarm, saveOrder, setMeta,
} from '../../src/data/repo'
import { buildCatalog } from '../../src/catalog/build'
import type { Item } from '../../src/types'
import { makeFarm, makeOrder, makeStock } from '../fixtures/builders'
import { testCatalog } from '../fixtures/testCatalog'

let db: HayDayDB
beforeEach(() => { db = createDb(crypto.randomUUID()) })

test('farms round-trip', async () => {
  await saveFarm(db, makeFarm())
  expect(await listFarms(db)).toEqual([makeFarm()])
})

test('deleting a farm removes its stock and orders and leaves other farms alone', async () => {
  await saveFarm(db, makeFarm())
  await saveFarm(db, makeFarm({ id: 'b1', name: 'Baby 1' }))
  await db.stock.bulkPut([...makeStock('main', { wheat: 3 }), ...makeStock('b1', { wheat: 4, corn: 1 })])
  await saveOrder(db, makeOrder('main', { bread: 1 }))
  await saveOrder(db, makeOrder('b1', { bread: 2 }))

  await deleteFarm(db, 'b1')

  expect((await listFarms(db)).map((f) => f.id)).toEqual(['main'])
  expect(await listStock(db)).toEqual(makeStock('main', { wheat: 3 }))
  expect((await listOrders(db)).map((o) => o.farmId)).toEqual(['main'])
})

test('saving an order merges duplicate items and drops empty lines', async () => {
  const o = makeOrder('main', {})
  o.lines = [{ itemId: 'bread', qty: 2 }, { itemId: 'bread', qty: 3 }, { itemId: 'wheat', qty: 0 }]
  await saveOrder(db, o)
  expect((await listOrders(db))[0].lines).toEqual([{ itemId: 'bread', qty: 5 }])
})

test('normalizeLines keeps first-seen order', () => {
  expect(normalizeLines([{ itemId: 'b', qty: 1 }, { itemId: 'a', qty: 1 }, { itemId: 'b', qty: 1 }]))
    .toEqual([{ itemId: 'b', qty: 2 }, { itemId: 'a', qty: 1 }])
})

test('meta values round-trip', async () => {
  expect(await getMeta(db, 'x')).toBeUndefined()
  await setMeta(db, 'x', { a: 1 })
  expect(await getMeta(db, 'x')).toEqual({ a: 1 })
})

describe('deleteCustomItem', () => {
  const jam: Item = { id: 'jam', name: 'Jam', category: 'made', storage: 'barn', unlockLevel: 1,
    source: { kind: 'machine', machineId: 'bakery', yield: 1, minutes: 5, ingredients: [{ itemId: 'apple', qty: 1 }] } }
  const toast: Item = { ...jam, id: 'toast', name: 'Toast',
    source: { kind: 'machine', machineId: 'bakery', yield: 1, minutes: 5, ingredients: [{ itemId: 'jam', qty: 1 }] } }

  beforeEach(async () => { await saveCustomItem(db, jam) })

  test('blocked when another item uses it', async () => {
    const c = buildCatalog(testCatalog, [], [jam, toast])
    expect(await deleteCustomItem(db, c, 'jam')).toEqual({ ok: false, reason: 'used-in-recipe' })
  })

  test('blocked when an open order has it', async () => {
    await saveOrder(db, makeOrder('main', { jam: 1 }))
    expect(await deleteCustomItem(db, buildCatalog(testCatalog, [], [jam]), 'jam'))
      .toEqual({ ok: false, reason: 'in-orders' })
  })

  test('blocked when any farm has it in stock', async () => {
    await db.stock.bulkPut(makeStock('b1', { jam: 2 }))
    expect(await deleteCustomItem(db, buildCatalog(testCatalog, [], [jam]), 'jam'))
      .toEqual({ ok: false, reason: 'in-stock' })
  })

  test('deleted when unused', async () => {
    expect(await deleteCustomItem(db, buildCatalog(testCatalog, [], [jam]), 'jam')).toEqual({ ok: true })
    expect(await db.customItems.count()).toBe(0)
  })
})
