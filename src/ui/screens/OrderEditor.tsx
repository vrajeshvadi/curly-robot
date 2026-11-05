import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { deleteOrder, saveOrder } from '../../data/repo'
import type { Farm, Ingredient, Order, OrderType } from '../../types'
import { useDb } from '../AppState'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { CountField } from '../components/CountField'
import { ItemPicker } from '../components/ItemPicker'
import { NoFarm } from '../components/NoFarm'
import { itemName } from '../itemOrder'
import { ORDER_TYPES } from '../orderLabels'
import { useCatalog } from '../useCatalog'
import { useCurrentFarm, useOrders } from '../useData'

export function OrderEditorScreen() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const farm = useCurrentFarm()
  const orders = useOrders()
  if (farm === undefined || !orders) return null
  if (farm === null) return <NoFarm />
  if (id === 'new') {
    const type = (ORDER_TYPES.find((t) => t.type === params.get('type'))?.type ?? 'truck') as OrderType
    const fresh: Order = { id: crypto.randomUUID(), farmId: farm.id, type, lines: [], reserve: false, status: 'open', createdAt: new Date().toISOString() }
    return <OrderEditor key="new" farm={farm} initial={fresh} isNew />
  }
  const order = orders.find((o) => o.id === id)
  if (!order) return <p>That order no longer exists.</p>
  return <OrderEditor key={order.id} farm={farm} initial={order} isNew={false} />
}

type Line = Ingredient & { key: string }

function OrderEditor({ farm, initial, isNew }: { farm: Farm; initial: Order; isNew: boolean }) {
  const db = useDb()
  const navigate = useNavigate()
  const catalog = useCatalog()
  const [type, setType] = useState<OrderType>(initial.type)
  const [reserve, setReserve] = useState(initial.reserve)
  const [lines, setLines] = useState<Line[]>(initial.lines.map((l) => ({ ...l, key: crypto.randomUUID() })))
  const [invalid, setInvalid] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)

  const setLine = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const validity = (key: string) => (ok: boolean) =>
    setInvalid((s) => { const n = new Set(s); if (ok) n.delete(key); else n.add(key); return n })

  const save = async () => {
    if (invalid.size) return
    const kept = lines.filter((l) => l.qty > 0)
    if (!kept.length) { setError('Add at least one item'); return }
    await saveOrder(db, { ...initial, type, reserve, lines: kept.map(({ itemId, qty }) => ({ itemId, qty })) })
    navigate(`/orders?type=${type}`)
  }

  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); void save() }}>
      <div aria-hidden={deleting || undefined} inert={deleting || undefined}>
        <h1>{isNew ? 'New order' : 'Edit order'}</h1>
        <div className="segmented" role="group" aria-label="Order type">
          {ORDER_TYPES.map((t) => (
            <button key={t.type} type="button" aria-pressed={type === t.type} onClick={() => setType(t.type)}>{t.label}</button>
          ))}
        </div>

        <ItemPicker farm={farm} lockedToggle onPick={(itemId) => { setError(''); setLines((ls) => [...ls, { itemId, qty: 1, key: crypto.randomUUID() }]) }} />

        <ul className="rows line-rows">
          {lines.map((l) => {
            const name = itemName(catalog, l.itemId)
            return (
              <li key={l.key} className="line-row">
                <span className="item-name">{name}</span>
                <CountField label={`${name} quantity`} hideLabel value={l.qty}
                  onChange={(n) => setLine(l.key, { qty: n })} onValidity={validity(l.key)} />
                <button type="button" className="icon-btn" aria-label={`Remove ${name}`}
                  onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>×</button>
              </li>
            )
          })}
        </ul>
        {error && <p className="field-error">{error}</p>}

        <label className="toggle">
          <input type="checkbox" checked={reserve} onChange={(e) => setReserve(e.target.checked)} />
          Reserve stock for this order
        </label>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">Save order</button>
          {!isNew && <button type="button" className="btn btn-danger-quiet" onClick={() => setDeleting(true)}>Delete order</button>}
        </div>
      </div>

      {deleting && (
        <ConfirmDialog title="Delete this order?" confirmLabel="Delete order" danger
          onConfirm={() => void deleteOrder(db, initial.id).then(() => navigate(`/orders?type=${type}`))}
          onCancel={() => setDeleting(false)}>
          <p>Stock doesn't change.</p>
        </ConfirmDialog>
      )}
    </form>
  )
}
