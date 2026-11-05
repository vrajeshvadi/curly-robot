import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ingredientsOf } from '../../catalog/build'
import { usedIn } from '../../catalog/validate'
import { deleteCustomItem, deleteOverride } from '../../data/repo'
import { useDb } from '../AppState'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { formatMinutes } from '../format'
import { itemName } from '../itemOrder'
import { useCatalog } from '../useCatalog'
import { sourceLabel } from './Catalog'

const BLOCKED: Record<'used-in-recipe' | 'in-orders' | 'in-stock', (n: string) => string> = {
  'used-in-recipe': (n) => `${n} is used in another recipe. Remove it from that recipe first.`,
  'in-orders': (n) => `${n} is in an open order. Finish or edit that order first.`,
  'in-stock': (n) => `${n} is still in stock on a farm. Set its count to 0 first.`,
}

export function ItemDetail() {
  const { itemId = '' } = useParams()
  const db = useDb()
  const navigate = useNavigate()
  const catalog = useCatalog()
  const isEdited = useLiveQuery(async () => (await db.overrides.get(itemId)) !== undefined, [db, itemId])
  const isCustom = useLiveQuery(async () => (await db.customItems.get(itemId)) !== undefined, [db, itemId])
  const [deleting, setDeleting] = useState(false)
  const [blocked, setBlocked] = useState('')

  const item = catalog.items[itemId]
  if (!item) return <p>This item isn't in the catalog. <Link to="/more/catalog">Back to the catalog</Link></p>
  const s = item.source
  const uses = usedIn(catalog, item.id)

  const remove = async () => {
    setDeleting(false)
    const r = await deleteCustomItem(db, catalog, item.id)
    if (r.ok) navigate('/more/catalog')
    else setBlocked(BLOCKED[r.reason](item.name))
  }

  return (
    <section className="item-detail">
      <div aria-hidden={deleting || undefined} inert={deleting || undefined}>
        <h1>{item.name}</h1>
        <p className="badges">
          {isEdited && <span className="badge">Edited</span>}
          {isCustom && <span className="badge">Your item</span>}
        </p>
        <dl className="facts">
          <dt>Made by</dt><dd>{sourceLabel(catalog, item)}</dd>
          <dt>Unlocks at</dt><dd>Level {item.unlockLevel}</dd>
          <dt>Stored in</dt><dd>{item.storage === 'barn' ? 'Barn' : 'Silo'}</dd>
          {s.kind !== 'none' && <><dt>Time</dt><dd>{formatMinutes(s.minutes)}</dd></>}
        </dl>
        {s.kind === 'field' && <p>Plant {s.seedUsed}, harvest {s.harvestYield}</p>}
        {(s.kind === 'machine' || s.kind === 'animal' || s.kind === 'tree') && <p>Makes {s.yield} per batch</p>}

        {ingredientsOf(item).length > 0 && (
          <>
            <h2>Needs</h2>
            <ul className="plan-list" aria-label="Ingredients">
              {ingredientsOf(item).map((i) => (
                <li key={i.itemId}><Link to={`/more/catalog/${i.itemId}`}>{itemName(catalog, i.itemId)}</Link> × {i.qty}</li>
              ))}
            </ul>
          </>
        )}

        {uses.length > 0 && (
          <>
            <h2>Used in</h2>
            <ul className="plan-list" aria-label="Used in">
              {uses.map((id) => <li key={id}><Link to={`/more/catalog/${id}`}>{itemName(catalog, id)}</Link></li>)}
            </ul>
          </>
        )}

        {blocked && <p className="field-error" role="alert">{blocked}</p>}
        <div className="form-actions">
          <Link className="btn btn-primary" to={`/more/catalog/${item.id}/edit`}>Edit item</Link>
          {isEdited && <button type="button" className="btn" onClick={() => void deleteOverride(db, item.id)}>Reset to original</button>}
          {isCustom && <button type="button" className="btn btn-danger-quiet" onClick={() => { setBlocked(''); setDeleting(true) }}>Delete item</button>}
        </div>
      </div>
      {deleting && (
        <ConfirmDialog title={`Delete ${item.name}?`} confirmLabel={`Delete ${item.name}`} danger
          onConfirm={() => void remove()} onCancel={() => setDeleting(false)}>
          <p>It's removed from your catalog.</p>
        </ConfirmDialog>
      )}
    </section>
  )
}
