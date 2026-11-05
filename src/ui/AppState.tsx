import { useLiveQuery } from 'dexie-react-hooks'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { HayDayDB } from '../data/db'
import { setMeta } from '../data/repo'
import type { Catalog, FarmId, ItemId } from '../types'

const DbContext = createContext<HayDayDB | null>(null)
const SeedContext = createContext<Catalog | null>(null)

interface AppState {
  farmId: FarmId | null
  setFarmId(id: FarmId): void
  topUps: ItemId[]
  addTopUp(id: ItemId): void
  removeTopUp(id: ItemId): void
  clearTopUps(): void
}
const StateContext = createContext<AppState | null>(null)

export function useDb(): HayDayDB {
  const db = useContext(DbContext)
  if (!db) throw new Error('useDb outside AppProviders')
  return db
}

export function useSeed(): Catalog {
  const seed = useContext(SeedContext)
  if (!seed) throw new Error('useSeed outside AppProviders')
  return seed
}

export function useAppState(): AppState {
  const s = useContext(StateContext)
  if (!s) throw new Error('useAppState outside AppProviders')
  return s
}

function StateProvider({ db, children }: { db: HayDayDB; children: ReactNode }) {
  const stored = useLiveQuery(async () => (await db.meta.get('currentFarmId'))?.value as FarmId | undefined, [db])
  const farmIds = useLiveQuery(async () => (await db.farms.toArray()).sort((a, b) => a.name.localeCompare(b.name)).map((f) => f.id), [db])
  const [topUpsByFarm, setTopUpsByFarm] = useState<Record<FarmId, ItemId[]>>({})

  const farmId = farmIds?.length ? (stored && farmIds.includes(stored) ? stored : farmIds[0]) : null

  const setFarmId = useCallback((id: FarmId) => { void setMeta(db, 'currentFarmId', id) }, [db])
  const update = useCallback(
    (fn: (xs: ItemId[]) => ItemId[]) => {
      if (!farmId) return
      setTopUpsByFarm((m) => ({ ...m, [farmId]: fn(m[farmId] ?? []) }))
    },
    [farmId],
  )

  const value = useMemo<AppState>(() => ({
    farmId,
    setFarmId,
    topUps: (farmId && topUpsByFarm[farmId]) || [],
    addTopUp: (id) => update((xs) => (xs.includes(id) ? xs : [...xs, id])),
    removeTopUp: (id) => update((xs) => xs.filter((x) => x !== id)),
    clearTopUps: () => update(() => []),
  }), [farmId, setFarmId, topUpsByFarm, update])

  return <StateContext.Provider value={value}>{children}</StateContext.Provider>
}

export function AppProviders({ db, seed, children }: { db: HayDayDB; seed: Catalog; children: ReactNode }) {
  return (
    <DbContext.Provider value={db}>
      <SeedContext.Provider value={seed}>
        <StateProvider db={db}>{children}</StateProvider>
      </SeedContext.Provider>
    </DbContext.Provider>
  )
}
