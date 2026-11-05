import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { buildCatalog } from '../catalog/build'
import type { Catalog } from '../types'
import { useDb, useSeed } from './AppState'

/**
 * The effective catalog (seed + the user's overrides + custom items, kept live), or
 * undefined until the user's edits have loaded. Use this where a snapshot is taken.
 */
export function useLoadedCatalog(): Catalog | undefined {
  const db = useDb()
  const seed = useSeed()
  const overrides = useLiveQuery(() => db.overrides.toArray(), [db])
  const custom = useLiveQuery(() => db.customItems.toArray(), [db])
  return useMemo(
    () => (overrides && custom ? buildCatalog(seed, overrides, custom) : undefined),
    [seed, overrides, custom],
  )
}

/** The effective catalog; while the user's edits load, the seed catalog alone. */
export function useCatalog(): Catalog {
  const seed = useSeed()
  return useLoadedCatalog() ?? seed
}
