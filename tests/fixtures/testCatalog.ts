import type { Catalog, Item } from '../../src/types'

const items: Item[] = [
  { id: 'wheat', name: 'Wheat', category: 'crop', storage: 'silo', unlockLevel: 1,
    source: { kind: 'field', seedUsed: 1, harvestYield: 2, minutes: 2 } },
  { id: 'corn', name: 'Corn', category: 'crop', storage: 'silo', unlockLevel: 2,
    source: { kind: 'field', seedUsed: 1, harvestYield: 2, minutes: 5 } },
  { id: 'chicken_feed', name: 'Chicken Feed', category: 'made', storage: 'barn', unlockLevel: 1,
    source: { kind: 'machine', machineId: 'feed_mill', yield: 3, minutes: 5,
      ingredients: [{ itemId: 'wheat', qty: 2 }, { itemId: 'corn', qty: 1 }] } },
  { id: 'egg', name: 'Egg', category: 'animal', storage: 'barn', unlockLevel: 1,
    source: { kind: 'animal', animalId: 'chicken', yield: 1, minutes: 20,
      ingredients: [{ itemId: 'chicken_feed', qty: 1 }] } },
  { id: 'bread', name: 'Bread', category: 'made', storage: 'barn', unlockLevel: 2,
    source: { kind: 'machine', machineId: 'bakery', yield: 1, minutes: 5,
      ingredients: [{ itemId: 'wheat', qty: 3 }] } },
  { id: 'cornbread', name: 'Cornbread', category: 'made', storage: 'barn', unlockLevel: 2,
    source: { kind: 'machine', machineId: 'bakery', yield: 1, minutes: 30,
      ingredients: [{ itemId: 'corn', qty: 2 }, { itemId: 'egg', qty: 2 }] } },
  { id: 'blackberry_muffin', name: 'Blackberry Muffin', category: 'made', storage: 'barn', unlockLevel: 40,
    source: { kind: 'machine', machineId: 'bakery', yield: 1, minutes: 30,
      ingredients: [{ itemId: 'wheat', qty: 2 }] } },
  { id: 'apple', name: 'Apple', category: 'tree', storage: 'barn', unlockLevel: 10,
    source: { kind: 'tree', treeId: 'apple_tree', yield: 1, minutes: 60 } },
  { id: 'bolt', name: 'Bolt', category: 'material', storage: 'barn', unlockLevel: 1,
    source: { kind: 'none' } },
]

export const testCatalog: Catalog = {
  catalogVersion: 0,
  items: Object.fromEntries(items.map((i) => [i.id, i])),
  machines: {
    feed_mill: { id: 'feed_mill', name: 'Feed Mill', unlockLevel: 1 },
    bakery: { id: 'bakery', name: 'Bakery', unlockLevel: 2 },
  },
  animals: { chicken: { id: 'chicken', name: 'Chicken', unlockLevel: 1 } },
  trees: { apple_tree: { id: 'apple_tree', name: 'Apple Tree', unlockLevel: 10 } },
}

/** Deep copy so tests can mutate freely. */
export function cloneCatalog(c: Catalog = testCatalog): Catalog {
  return structuredClone(c)
}
