import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { adjustCount, saveQuickCount, setMin } from '../../actions/stockActions'
import { isLocked, levelOf, stockLevels, type StockLevel } from '../../planner/stock'
import type { Category, Farm, Item, ItemId, Storage } from '../../types'
import { useDb } from '../AppState'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { CountField } from '../components/CountField'
import { NoFarm } from '../components/NoFarm'
import { sortItems } from '../itemOrder'
import { useCatalog } from '../useCatalog'
import { useCurrentFarm, useOrders, useStock } from '../useData'

type Row = { id: ItemId; name: string; storage?: Storage; category?: Category; level: StockLevel }

const CATEGORIES: { value: Category | 'all'; label: string }[] = [
  { value: 'all', label: 'All categories' },
  { value: 'crop', label: 'Crops' },
  { value: 'tree', label: 'Trees and bushes' },
  { value: 'animal', label: 'Animal goods' },
  { value: 'made', label: 'Made goods' },
  { value: 'material', label: 'Materials' },
]

export function Stock() {
  const farm = useCurrentFarm()
  if (farm === undefined) return null
  if (farm === null) return <NoFarm />
  return <StockList farm={farm} />
}

function StockList({ farm }: { farm: Farm }) {
  const db = useDb()
  const catalog = useCatalog()
  const stock = useStock()
  const orders = useOrders()
  const [query, setQuery] = useState('')
  const [storage, setStorage] = useState<Storage | 'all'>('all')
  const [category, setCategory] = useState<Category | 'all'>('all')
  const [showLocked, setShowLocked] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)

  const rows = useMemo<Row[]>(() => {
    const levels = stockLevels(farm.id, stock ?? [], orders ?? [])
    const known: Row[] = sortItems(Object.values(catalog.items))
      .filter((i: Item) => showLocked || !isLocked(i, farm, catalog))
      .map((i) => ({ id: i.id, name: i.name, storage: i.storage, category: i.category, level: levelOf(levels, i.id) }))
    const unknown: Row[] = [...levels.keys()]
      .filter((id) => !catalog.items[id])
      .map((id) => ({ id, name: `Unknown item (${id})`, level: levelOf(levels, id) }))
    return [...known, ...unknown]
  }, [catalog, farm, stock, orders, showLocked])

  if (!stock || !orders) return null
  const q = query.trim().toLowerCase()
  const shown = rows.filter((r) => (storage === 'all' || r.storage === storage) && (category === 'all' || r.category === category)
    && (!q || r.name.toLowerCase().includes(q)))

  return (
    <section>
      <div className="screen-head">
        <h1>Stock</h1>
        <Link className="btn btn-small" to="/stock/count">Quick count</Link>
      </div>

      <div className="filters">
        <label className="visually-hidden" htmlFor="stock-search">Search items</label>
        <input id="stock-search" type="search" placeholder="Search items" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="segmented" role="group" aria-label="Storage">
          {(['all', 'barn', 'silo'] as const).map((s) => (
            <button key={s} type="button" aria-pressed={storage === s} onClick={() => setStorage(s)}>
              {s === 'all' ? 'All' : s === 'barn' ? 'Barn' : 'Silo'}
            </button>
          ))}
        </div>
        <label className="visually-hidden" htmlFor="stock-category">Category</label>
        <select id="stock-category" value={category} onChange={(e) => setCategory(e.target.value as Category | 'all')}>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <label className="toggle">
          <input type="checkbox" checked={showLocked} onChange={(e) => setShowLocked(e.target.checked)} />
          Show locked
        </label>
      </div>

      <ul className="rows stock-rows">
        {shown.map((r) => (
          <li key={r.id} aria-label={r.name} className="stock-row">
            <button type="button" className="stock-name" aria-label={`Edit ${r.name}`} onClick={() => setEditing(r)}>
              <span className="item-name">{r.name}</span>
              <span className="stock-detail">
                {r.level.reserved > 0 && <span>{r.level.reserved} reserved</span>}
                {r.level.reserved > 0 && <span>{r.level.free} free</span>}
                {r.level.min > 0 && <span className={r.level.low ? 'is-low' : undefined}>Min {r.level.min}</span>}
              </span>
              {r.level.reserved > r.level.total && <span className="field-error">More reserved than in stock</span>}
            </button>
            <span className="stock-total num">{r.level.total}</span>
            <span className="stepper">
              <button type="button" className="icon-btn" aria-label={`Remove 1 ${r.name}`} onClick={() => void adjustCount(db, farm.id, r.id, -1)}>−</button>
              <button type="button" className="icon-btn" aria-label={`Add 1 ${r.name}`} onClick={() => void adjustCount(db, farm.id, r.id, 1)}>+</button>
            </span>
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="muted">No items match. Clear the search or switch on "Show locked".</p>}

      {editing && <EditSheet farm={farm} row={editing} onClose={() => setEditing(null)} />}
    </section>
  )
}

function EditSheet({ farm, row, onClose }: { farm: Farm; row: Row; onClose(): void }) {
  const db = useDb()
  const [total, setTotal] = useState(row.level.total)
  const [min, setMinValue] = useState(row.level.min)
  const [bad, setBad] = useState({ total: false, min: false })

  const save = async () => {
    if (bad.total || bad.min) return
    await saveQuickCount(db, farm.id, { [row.id]: total })
    await setMin(db, farm.id, row.id, min)
    onClose()
  }

  return (
    <ConfirmDialog title={row.name} confirmLabel="Save" onConfirm={() => void save()} onCancel={onClose}>
      <div className="field-grid">
        <CountField label="Count" value={total} onChange={setTotal} onValidity={(ok) => setBad((b) => ({ ...b, total: !ok }))} />
        <CountField label="Minimum" value={min} onChange={setMinValue} onValidity={(ok) => setBad((b) => ({ ...b, min: !ok }))} />
      </div>
    </ConfirmDialog>
  )
}
