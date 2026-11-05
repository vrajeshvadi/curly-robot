import type { Catalog, Farm } from '../types'

/** A farm with sensible defaults: machines unlocked at its level are owned with 2 slots; counts start at 0. */
export function newFarm(catalog: Catalog, name: string, level: number): Farm {
  const zero = (r: Record<string, unknown>) => Object.fromEntries(Object.keys(r).map((k) => [k, 0]))
  return {
    id: crypto.randomUUID(),
    name,
    level,
    barnCapacity: 50,
    siloCapacity: 50,
    fields: 0,
    machines: Object.fromEntries(
      Object.values(catalog.machines).map((m) => [m.id, { owned: m.unlockLevel <= level, slots: 2 }]),
    ),
    animals: zero(catalog.animals),
    trees: zero(catalog.trees),
  }
}
