import type { Catalog, Category, Item, ItemId } from '../types'

const ORDER: Category[] = ['crop', 'tree', 'animal', 'made', 'material']

/** Category order (crops first, materials last), then by name. */
export function sortItems(items: Item[]): Item[] {
  return [...items].sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category) || a.name.localeCompare(b.name))
}

export function itemName(catalog: Catalog, id: ItemId): string {
  return catalog.items[id]?.name ?? `Unknown item (${id})`
}
