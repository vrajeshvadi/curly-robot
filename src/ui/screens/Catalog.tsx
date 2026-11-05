import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Catalog, Item } from '../../types'
import { useDb } from '../AppState'
import { sortItems } from '../itemOrder'
import { useCatalog } from '../useCatalog'

export function sourceLabel(catalog: Catalog, item: Item): string {
  const s = item.source
  switch (s.kind) {
    case 'field': return 'Fields'
    case 'machine': return catalog.machines[s.machineId]?.name ?? s.machineId
    case 'animal': return catalog.animals[s.animalId]?.name ?? s.animalId
    case 'tree': return catalog.trees[s.treeId]?.name ?? s.treeId
    case 'none': return 'Not produced'
  }
}

export function CatalogScreen() {
  const db = useDb()
  const catalog = useCatalog()
  const overridden = useLiveQuery(async () => new Set((await db.overrides.toArray()).map((o) => o.itemId)), [db])
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const items = sortItems(Object.values(catalog.items)).filter((i) => !q || i.name.toLowerCase().includes(q))

  return (
    <section>
      <div className="screen-head">
        <h1>Catalog</h1>
        <Link className="btn btn-small" to="/more/catalog/new">Add item</Link>
      </div>
      <label className="visually-hidden" htmlFor="catalog-search">Search the catalog</label>
      <input id="catalog-search" type="search" placeholder="Search the catalog" value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul className="rows catalog-rows">
        {items.map((i) => (
          <li key={i.id}>
            <Link to={`/more/catalog/${i.id}`} className="row-link">
              <span className="item-name">{i.name}</span>{' '}
              <span className="muted">
                {sourceLabel(catalog, i)}, level {i.unlockLevel}
                {overridden?.has(i.id) && <span className="badge">Edited</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {items.length === 0 && <p className="muted">No item matches. <Link to="/more/catalog/new">Add it to the catalog</Link></p>}
    </section>
  )
}
