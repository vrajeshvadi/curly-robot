import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveQuickCount } from '../../actions/stockActions'
import { isLocked, levelOf, stockLevels } from '../../planner/stock'
import type { Catalog, Farm, ItemId } from '../../types'
import { useDb } from '../AppState'
import { CountField } from '../components/CountField'
import { NoFarm } from '../components/NoFarm'
import { sortItems } from '../itemOrder'
import { useLoadedCatalog } from '../useCatalog'
import { useCurrentFarm, useStock } from '../useData'

export function QuickCount() {
  const farm = useCurrentFarm()
  const stock = useStock()
  const catalog = useLoadedCatalog()
  if (farm === undefined || !stock || !catalog) return null
  if (farm === null) return <NoFarm />
  // Keyed by farm so switching farm starts a fresh count with that farm's numbers.
  return <Counter key={farm.id} farm={farm} catalog={catalog} totals={stockLevels(farm.id, stock, [])} />
}

function Counter({ farm, catalog, totals }: { farm: Farm; catalog: Catalog; totals: ReturnType<typeof stockLevels> }) {
  const db = useDb()
  const navigate = useNavigate()
  const items = useMemo(() => sortItems(Object.values(catalog.items)).filter((i) => !isLocked(i, farm, catalog)), [catalog, farm])
  // Snapshot of starting totals so live updates don't move the field under the user's thumb.
  const [start] = useState(() => new Map(items.map((i) => [i.id, levelOf(totals, i.id).total])))
  const [index, setIndex] = useState(0)
  const [entries, setEntries] = useState<Record<ItemId, number>>({})
  const [draft, setDraft] = useState<number | null>(null)
  const [valid, setValid] = useState(true)

  const item = items[index]
  const current = item ? (entries[item.id] ?? start.get(item.id) ?? 0) : 0

  const move = (record: boolean) => {
    if (record && item) {
      if (!valid) return
      setEntries((e) => ({ ...e, [item.id]: draft ?? current }))
    }
    setDraft(null)
    setValid(true)
    setIndex((i) => i + 1)
  }

  const done = async () => {
    const all = { ...entries }
    if (item && draft !== null && valid) all[item.id] = draft
    await saveQuickCount(db, farm.id, all)
    navigate('/stock')
  }

  return (
    <section className="quick-count">
      <p className="muted">{item ? `${index + 1} of ${items.length}` : `${items.length} of ${items.length}`}</p>
      {item ? (
        <>
          <h1>{item.name}</h1>
          <p className="muted">{item.storage === 'barn' ? 'Barn' : 'Silo'}</p>
          <CountField key={item.id} label="Count" value={current}
            onChange={(n) => setDraft(n)} onValidity={setValid} />
          <div className="form-actions">
            <button type="button" className="btn btn-primary" onClick={() => move(true)}>Next</button>
            <button type="button" className="btn" onClick={() => move(false)}>Skip</button>
          </div>
        </>
      ) : (
        <h1>All counted</h1>
      )}
      <div className="form-actions">
        <button type="button" className="btn btn-primary" onClick={() => void done()}>Done</button>
        <button type="button" className="btn btn-danger-quiet" onClick={() => navigate('/stock')}>Cancel</button>
      </div>
    </section>
  )
}
