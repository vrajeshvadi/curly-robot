import { Link } from 'react-router-dom'
import { canFillNow, stockLevels } from '../../planner/stock'
import type { Farm, Storage } from '../../types'
import { useAppState } from '../AppState'
import { FillBar } from '../components/FillBar'
import { itemName } from '../itemOrder'
import { linesSummary, ORDER_TYPES } from '../orderLabels'
import { useCatalog } from '../useCatalog'
import { useCurrentFarm, useOrders, useStock } from '../useData'

export function Home() {
  const farm = useCurrentFarm()
  if (farm === undefined) return null
  if (farm === null) {
    return (
      <section className="empty">
        <h1>Hay Day Manager</h1>
        <p>Track stock, orders and plans for your main farm and baby farms.</p>
        <Link className="btn btn-primary" to="/more/farms/new">Add your first farm</Link>
      </section>
    )
  }
  return <Dashboard farm={farm} />
}

function Dashboard({ farm }: { farm: Farm }) {
  const catalog = useCatalog()
  const stock = useStock()
  const orders = useOrders()
  const { topUps, addTopUp } = useAppState()
  if (!stock || !orders) return null

  const used: Record<Storage, number> = { barn: 0, silo: 0 }
  for (const r of stock) {
    const st = r.farmId === farm.id ? catalog.items[r.itemId]?.storage : undefined
    if (st) used[st] += r.total
  }
  const open = orders.filter((o) => o.farmId === farm.id && o.status === 'open')
  const low = [...stockLevels(farm.id, stock, orders)]
    .filter(([, lv]) => lv.low)
    .map(([id, lv]) => ({ id, name: itemName(catalog, id), lv }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <section className="dashboard">
      <h1>{farm.name}</h1>
      <p className="muted">Level {farm.level}</p>

      <div className="storage-bars">
        <FillBar label="Barn" used={used.barn} capacity={farm.barnCapacity} />
        <FillBar label="Silo" used={used.silo} capacity={farm.siloCapacity} />
      </div>

      <Link className="btn btn-primary btn-block btn-hero" to="/plan?orders=all">Plan all open orders</Link>

      <h2>Open orders</h2>
      {open.length === 0 ? (
        <p className="muted">No open orders. <Link to="/orders/new">Add one</Link></p>
      ) : (
        <ul className="rows">
          {open.map((o) => {
            const summary = linesSummary(catalog, o.lines)
            return (
              <li key={o.id} aria-label={summary} className="home-order">
                <Link to={`/orders?type=${o.type}`} className="row-link">
                  <span>
                    <span className="muted">{ORDER_TYPES.find((t) => t.type === o.type)?.label}</span>{' '}
                    {summary}
                  </span>
                  {canFillNow(o, stock, orders) && <span className="badge badge-ready">Can fill now</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <h2>Low stock</h2>
      {low.length === 0 ? (
        <p className="muted">Nothing is below its minimum. Set minimums on the Stock screen.</p>
      ) : (
        <ul className="rows">
          {low.map(({ id, name, lv }) => {
            const added = topUps.includes(id)
            return (
              <li key={id} aria-label={`${name} low`} className="low-row">
                <span className="item-name">{name}</span>
                <span className="num">{lv.free} of {lv.min}</span>
                <button type="button" className="btn btn-small" disabled={added} onClick={() => addTopUp(id)}>
                  {added ? 'Added' : 'Add to to-make'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
