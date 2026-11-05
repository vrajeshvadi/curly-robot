import Dexie, { type Table } from 'dexie'
import type { CatalogOverride, CustomItem, Farm, ItemId, Order, StockRow } from '../types'

export interface MetaRow {
  key: string
  value: unknown
}

export class HayDayDB extends Dexie {
  declare farms: Table<Farm, string>
  declare stock: Table<StockRow, [string, ItemId]>
  declare orders: Table<Order, string>
  declare overrides: Table<CatalogOverride, ItemId>
  declare customItems: Table<CustomItem, ItemId>
  declare meta: Table<MetaRow, string>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      farms: 'id',
      stock: '[farmId+itemId], farmId, itemId',
      orders: 'id, farmId, status',
      overrides: 'itemId',
      customItems: 'id',
      meta: 'key',
    })
  }
}

export function createDb(name = 'hay-day-manager'): HayDayDB {
  return new HayDayDB(name)
}

export const db = createDb()
