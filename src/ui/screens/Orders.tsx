import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { canFillNow } from '../../planner/stock'
import type { Farm, Order, OrderType } from '../../types'
import { MarkDoneSheet } from '../components/MarkDoneSheet'
import { NoFarm } from '../components/NoFarm'
import { linesSummary, ORDER_TYPES } from '../orderLabels'
import { useCatalog } from '../useCatalog'
import { useCurrentFarm, useOrders, useStock } from '../useData'

export function Orders() {
  const farm = useCurrentFarm()
  if (farm === undefined) return null
  if (farm === null) return <NoFarm />
  return <OrderList farm={farm} />
}

function OrderList({ farm }: { farm: Farm }) {
  const catalog = useCatalog()
  const orders = useOrders()
  const stock = useStock()
  const [params, setParams] = useSearchParams()
  const type = (ORDER_TYPES.find((t) => t.type === params.get('type'))?.type ?? 'truck') as OrderType
  const [closing, setClosing] = useState<Order | null>(null)
  if (!orders || !stock) return null

  const open = orders.filter((o) => o.farmId === farm.id && o.status === 'open')
  const shown = open.filter((o) => o.type === type)
  const label = ORDER_TYPES.find((t) => t.type === type)!.label

  return (
    <section>
      <div aria-hidden={closing ? true : undefined} inert={closing ? true : undefined}>
        <h1>Orders</h1>
        <div className="tabs" role="tablist" aria-label="Order type">
          {ORDER_TYPES.map((t) => {
            const n = open.filter((o) => o.type === t.type).length
            return (
              <button key={t.type} role="tab" type="button" aria-selected={t.type === type} aria-label={n > 0 ? `${t.label}, ${n} open` : t.label}
                onClick={() => setParams({ type: t.type }, { replace: true })}>
                {t.label}{n > 0 && <span className="tab-count">{n}</span>}
              </button>
            )
          })}
        </div>

        <ul className="rows order-rows">
          {shown.map((o) => {
            const summary = linesSummary(catalog, o.lines)
            return (
              <li key={o.id} aria-label={summary} className="order-row">
                <Link to={`/orders/${o.id}`} className="order-lines">
                  {o.lines.map((l) => (
                    <span key={l.itemId}><span className="num">{l.qty}</span> {catalog.items[l.itemId]?.name ?? `Unknown item (${l.itemId})`}</span>
                  ))}
                </Link>
                <div className="order-meta">
                  {canFillNow(o, stock, orders) && <span className="badge badge-ready">Can fill now</span>}
                  {o.reserve && <span className="badge">Reserved</span>}
                  <button type="button" className="btn btn-small" onClick={() => setClosing(o)}>Mark done</button>
                </div>
              </li>
            )
          })}
        </ul>
        {shown.length === 0 && <p className="muted">No open {label.toLowerCase()} orders.</p>}
        <Link className="btn btn-primary" to={`/orders/new?type=${type}`}>New {label.toLowerCase()} order</Link>
      </div>
      {closing && <MarkDoneSheet order={closing} onClose={() => setClosing(null)} />}
    </section>
  )
}
