export type ItemId = string
export type FarmId = string

export type Category = 'crop' | 'tree' | 'animal' | 'made' | 'material'
export type Storage = 'barn' | 'silo'

export interface Ingredient {
  itemId: ItemId
  qty: number
}

export type ItemSource =
  | { kind: 'field'; seedUsed: number; harvestYield: number; minutes: number }
  | { kind: 'tree'; treeId: string; yield: number; minutes: number }
  | { kind: 'animal'; animalId: string; yield: number; minutes: number; ingredients: Ingredient[] }
  | { kind: 'machine'; machineId: string; yield: number; minutes: number; ingredients: Ingredient[] }
  | { kind: 'none' }

export interface Item {
  id: ItemId
  name: string
  category: Category
  storage: Storage
  unlockLevel: number
  source: ItemSource
}

export interface Resource {
  id: string
  name: string
  unlockLevel: number
}

export type Machine = Resource

export interface Catalog {
  catalogVersion: number
  items: Record<ItemId, Item>
  machines: Record<string, Resource>
  animals: Record<string, Resource>
  trees: Record<string, Resource>
}

export interface Farm {
  id: FarmId
  name: string
  level: number
  barnCapacity: number
  siloCapacity: number
  fields: number
  machines: Record<string, { owned: boolean; slots: number }>
  animals: Record<string, number>
  trees: Record<string, number>
}

export interface StockRow {
  farmId: FarmId
  itemId: ItemId
  total: number
  min: number
}

export type OrderType = 'truck' | 'boat' | 'visitor'

export interface Order {
  id: string
  farmId: FarmId
  type: OrderType
  lines: Ingredient[]
  reserve: boolean
  status: 'open' | 'done'
  createdAt: string
}

export interface CatalogOverride {
  itemId: ItemId
  item: Item
}

export type CustomItem = Item

export type CatalogIssue = {
  kind: 'missing-ingredient' | 'cycle' | 'non-positive' | 'unknown-resource'
  itemId: ItemId
  detail: string
}
