import { useLiveQuery } from 'dexie-react-hooks'
import { listFarms, listOrders, listStock } from '../data/repo'
import type { Farm, Order, StockRow } from '../types'
import { useAppState, useDb } from './AppState'

/** Live lists; `undefined` while the first read is in progress. */
export function useFarms(): Farm[] | undefined {
  const db = useDb()
  return useLiveQuery(() => listFarms(db), [db])
}

export function useStock(): StockRow[] | undefined {
  const db = useDb()
  return useLiveQuery(() => listStock(db), [db])
}

export function useOrders(): Order[] | undefined {
  const db = useDb()
  return useLiveQuery(() => listOrders(db), [db])
}

export function useCurrentFarm(): Farm | null | undefined {
  const farms = useFarms()
  const { farmId } = useAppState()
  if (!farms) return undefined
  return farms.find((f) => f.id === farmId) ?? null
}
