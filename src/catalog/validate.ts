import type { Catalog, CatalogIssue, Item, ItemId } from '../types'
import { ingredientsOf } from './build'

function checkItem(c: Catalog, item: Item): CatalogIssue[] {
  const issues: CatalogIssue[] = []
  const add = (kind: CatalogIssue['kind'], detail: string) => issues.push({ kind, itemId: item.id, detail })
  const s = item.source

  if (s.kind === 'field') {
    if (!(s.minutes > 0)) add('non-positive', 'Growing time must be more than 0')
    if (!(s.seedUsed >= 0)) add('non-positive', 'Seed used cannot be negative')
    if (!(s.harvestYield > s.seedUsed)) add('non-positive', 'Harvest must be more than the seed used')
  } else if (s.kind !== 'none') {
    if (!(s.yield > 0)) add('non-positive', 'Yield must be more than 0')
    if (!(s.minutes > 0)) add('non-positive', 'Time must be more than 0')
    if (s.kind === 'machine' && !c.machines[s.machineId]) add('unknown-resource', `Unknown machine "${s.machineId}"`)
    if (s.kind === 'animal' && !c.animals[s.animalId]) add('unknown-resource', `Unknown animal "${s.animalId}"`)
    if (s.kind === 'tree' && !c.trees[s.treeId]) add('unknown-resource', `Unknown tree "${s.treeId}"`)
  }

  for (const ing of ingredientsOf(item)) {
    if (!(ing.qty > 0)) add('non-positive', `Quantity of "${ing.itemId}" must be more than 0`)
    if (!c.items[ing.itemId]) add('missing-ingredient', `Ingredient "${ing.itemId}" is not in the catalog`)
  }
  return issues
}

function findCycles(c: Catalog): CatalogIssue[] {
  const WHITE = 0, GREY = 1, BLACK = 2
  const colour = new Map<ItemId, number>()
  const issues: CatalogIssue[] = []
  const path: ItemId[] = []

  const visit = (id: ItemId) => {
    colour.set(id, GREY)
    path.push(id)
    const item = c.items[id]
    for (const ing of item ? ingredientsOf(item) : []) {
      if (!c.items[ing.itemId]) continue
      const col = colour.get(ing.itemId) ?? WHITE
      if (col === GREY) {
        const loop = [...path.slice(path.indexOf(ing.itemId)), ing.itemId]
        const names = loop.map((x) => c.items[x]?.name ?? x).join(' → ')
        issues.push({ kind: 'cycle', itemId: id, detail: `Recipe loop: ${names}` })
      } else if (col === WHITE) {
        visit(ing.itemId)
      }
    }
    path.pop()
    colour.set(id, BLACK)
  }

  for (const id of Object.keys(c.items)) if ((colour.get(id) ?? WHITE) === WHITE) visit(id)
  return issues
}

export function validateCatalog(c: Catalog): CatalogIssue[] {
  return [...Object.values(c.items).flatMap((item) => checkItem(c, item)), ...findCycles(c)]
}

/** Validates the catalog with `item` inserted or replaced. The given catalog is not modified. */
export function validateItemEdit(c: Catalog, item: Item): CatalogIssue[] {
  return validateCatalog({ ...c, items: { ...c.items, [item.id]: item } })
}

/** IDs of items whose recipe uses `itemId`, sorted by name. */
export function usedIn(c: Catalog, itemId: ItemId): ItemId[] {
  return Object.values(c.items)
    .filter((i) => ingredientsOf(i).some((ing) => ing.itemId === itemId))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((i) => i.id)
}
