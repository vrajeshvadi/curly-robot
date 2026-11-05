import type { Catalog, Ingredient, OrderType } from '../types'
import { itemName } from './itemOrder'

export const ORDER_TYPES: { type: OrderType; label: string }[] = [
  { type: 'truck', label: 'Truck' },
  { type: 'boat', label: 'Boat' },
  { type: 'visitor', label: 'Visitor' },
]

export function linesSummary(catalog: Catalog, lines: Ingredient[]): string {
  return lines.map((l) => `${itemName(catalog, l.itemId)} × ${l.qty}`).join(', ')
}
