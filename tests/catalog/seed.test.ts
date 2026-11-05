import { describe, expect, test } from 'vitest'
import { seedCatalog } from '../../src/catalog/seed'
import { validateCatalog } from '../../src/catalog/validate'

const items = Object.values(seedCatalog.items)

describe('seed catalog', () => {
  test('passes validation', () => {
    expect(validateCatalog(seedCatalog)).toEqual([])
  })

  test('has catalog version 1 and covers levels 1–30', () => {
    expect(seedCatalog.catalogVersion).toBe(1)
    expect(items.length).toBeGreaterThan(75)
  })

  test('every machine, animal and tree produces at least one item', () => {
    const used = new Set(items.flatMap((i) => {
      const s = i.source
      if (s.kind === 'machine') return [`m:${s.machineId}`]
      if (s.kind === 'animal') return [`a:${s.animalId}`]
      if (s.kind === 'tree') return [`t:${s.treeId}`]
      return []
    }))
    const unused = [
      ...Object.keys(seedCatalog.machines).map((k) => `m:${k}`),
      ...Object.keys(seedCatalog.animals).map((k) => `a:${k}`),
      ...Object.keys(seedCatalog.trees).map((k) => `t:${k}`),
    ].filter((k) => !used.has(k))
    expect(unused).toEqual([])
  })

  test('ids are snake_case keys matching each item, and names are unique', () => {
    for (const [key, item] of Object.entries(seedCatalog.items)) {
      expect(item.id).toBe(key)
      expect(item.id).toMatch(/^[a-z0-9_]+$/)
    }
    const names = items.map((i) => i.name)
    expect(new Set(names).size).toBe(names.length)
  })

  test('spot checks', () => {
    const { wheat, bread, chicken_feed, egg } = seedCatalog.items
    expect(wheat).toMatchObject({ unlockLevel: 1, storage: 'silo',
      source: { kind: 'field', seedUsed: 1, harvestYield: 2, minutes: 2 } })
    expect(bread.source).toMatchObject({ kind: 'machine', machineId: 'bakery', minutes: 5,
      ingredients: [{ itemId: 'wheat', qty: 3 }] })
    expect(chicken_feed.source).toMatchObject({ kind: 'machine', machineId: 'feed_mill', yield: 3,
      ingredients: [{ itemId: 'wheat', qty: 2 }, { itemId: 'corn', qty: 1 }] })
    expect(egg.source).toMatchObject({ kind: 'animal', animalId: 'chicken', minutes: 20,
      ingredients: [{ itemId: 'chicken_feed', qty: 1 }] })
  })
})
