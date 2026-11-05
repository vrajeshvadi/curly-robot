import { useId, useState } from 'react'
import { isLocked } from '../../planner/stock'
import type { Farm, ItemId } from '../../types'
import { sortItems } from '../itemOrder'
import { useCatalog } from '../useCatalog'

/** Search box over items (only those unlocked on `farm`, when given); tapping a result calls onPick and clears the search. */
export function ItemPicker({ farm, onPick, label = 'Find an item', lockedToggle = false }: {
  farm: Farm | null; onPick(id: ItemId): void; label?: string; lockedToggle?: boolean
}) {
  const id = useId()
  const catalog = useCatalog()
  const [query, setQuery] = useState('')
  const [showLocked, setShowLocked] = useState(false)
  const q = query.trim().toLowerCase()
  const matches = q
    ? sortItems(Object.values(catalog.items))
        .filter((i) => (!farm || showLocked || !isLocked(i, farm, catalog)) && i.name.toLowerCase().includes(q))
        .slice(0, 8)
    : []

  return (
    <div className="picker">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="search" value={query} placeholder="Type an item name" onChange={(e) => setQuery(e.target.value)} />
      {lockedToggle && farm && (
        <label className="toggle">
          <input type="checkbox" checked={showLocked} onChange={(e) => setShowLocked(e.target.checked)} />
          Show locked items
        </label>
      )}
      {matches.length > 0 && (
        <ul className="picker-results">
          {matches.map((i) => (
            <li key={i.id}>
              <button type="button" aria-label={`Add ${i.name}`} onClick={() => { onPick(i.id); setQuery('') }}>
                {i.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {q && matches.length === 0 && <p className="muted">No {farm && !showLocked ? 'unlocked ' : ''}item matches "{query}".</p>}
    </div>
  )
}
