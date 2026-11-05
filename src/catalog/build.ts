import type { Catalog, CatalogOverride, Ingredient, Item } from '../types'

/** Seed items, each replaced by its override if one exists, plus custom items. The seed is not modified. */
export function buildCatalog(seed: Catalog, overrides: CatalogOverride[], custom: Item[]): Catalog {
  const items: Record<string, Item> = { ...seed.items }
  for (const o of overrides) items[o.itemId] = o.item
  for (const c of custom) items[c.id] = c
  return { ...seed, items }
}

export function ingredientsOf(item: Item): Ingredient[] {
  const s = item.source
  return s.kind === 'machine' || s.kind === 'animal' ? s.ingredients : []
}
