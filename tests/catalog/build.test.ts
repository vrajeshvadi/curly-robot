import { expect, test } from 'vitest'
import { buildCatalog, ingredientsOf } from '../../src/catalog/build'
import type { Item } from '../../src/types'
import { testCatalog } from '../fixtures/testCatalog'

const customJam: Item = {
  id: 'jam', name: 'Jam', category: 'made', storage: 'barn', unlockLevel: 1,
  source: { kind: 'machine', machineId: 'bakery', yield: 1, minutes: 10,
    ingredients: [{ itemId: 'apple', qty: 2 }] },
}

test('overrides replace seed items and custom items are added without touching the seed', () => {
  const built = buildCatalog(
    testCatalog,
    [{ itemId: 'bread', item: { ...testCatalog.items.bread, name: 'Bread!' } }],
    [customJam],
  )
  expect(built.items.bread.name).toBe('Bread!')
  expect(built.items.jam).toEqual(customJam)
  expect(testCatalog.items.bread.name).toBe('Bread')
})

test('ingredientsOf returns recipe ingredients, empty for fields, trees and materials', () => {
  expect(ingredientsOf(testCatalog.items.bread)).toEqual([{ itemId: 'wheat', qty: 3 }])
  expect(ingredientsOf(testCatalog.items.egg)).toEqual([{ itemId: 'chicken_feed', qty: 1 }])
  expect(ingredientsOf(testCatalog.items.wheat)).toEqual([])
  expect(ingredientsOf(testCatalog.items.apple)).toEqual([])
  expect(ingredientsOf(testCatalog.items.bolt)).toEqual([])
})
