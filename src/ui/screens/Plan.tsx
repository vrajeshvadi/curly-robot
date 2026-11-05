import { useState } from 'react'
import { Link } from 'react-router-dom'
import { logBatch } from '../../actions/stockActions'
import type { PlanWarning } from '../../planner/estimate'
import { plan as makePlan, type Plan } from '../../planner/plan'
import type { Catalog, Farm, Order } from '../../types'
import { useAppState, useDb } from '../AppState'
import { NoFarm } from '../components/NoFarm'
import { formatMinutes } from '../format'
import { itemName } from '../itemOrder'
import { linesSummary, ORDER_TYPES } from '../orderLabels'
import { useCatalog } from '../useCatalog'
import { useCurrentFarm, useFarms, useOrders, useStock } from '../useData'

export function PlanScreen() {
  const farm = useCurrentFarm()
  if (farm === undefined) return null
  if (farm === null) return <NoFarm />
  return <Planner farm={farm} />
}

function resourceName(catalog: Catalog, key: string): string {
  const [kind, id] = key.split(':')
  if (kind === 'field') return `${itemName(catalog, id)} fields`
  const table = kind === 'machine' ? catalog.machines : kind === 'animal' ? catalog.animals : catalog.trees
  return table[id]?.name ?? id
}

function warningText(catalog: Catalog, w: PlanWarning): string {
  switch (w.kind) {
    case 'no-seed': return `Not enough ${itemName(catalog, w.itemId)} left to plant: you have ${w.have}, planting needs ${w.need}.`
    case 'barn-overflow': return `The barn would hold ${w.projected}, over its ${w.capacity} capacity.`
    case 'silo-overflow': return `The silo would hold ${w.projected}, over its ${w.capacity} capacity.`
    case 'reserved-exceeds-total': return `${itemName(catalog, w.itemId)}: ${w.reserved} reserved but only ${w.total} in stock.`
  }
}

function orderLabel(catalog: Catalog, o: Order) {
  return `${ORDER_TYPES.find((t) => t.type === o.type)?.label}: ${linesSummary(catalog, o.lines)}`
}

function Planner({ farm }: { farm: Farm }) {
  const db = useDb()
  const catalog = useCatalog()
  const farms = useFarms()
  const stock = useStock()
  const orders = useOrders()
  const { topUps, removeTopUp } = useAppState()
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [useOtherFarms, setUseOtherFarms] = useState(true)
  const [notice, setNotice] = useState('')
  if (!farms || !stock || !orders) return null

  const made = async (itemId: string) => {
    const { short } = await logBatch(db, catalog, farm.id, itemId)
    setNotice(short.length
      ? `Made 1 batch of ${itemName(catalog, itemId)}. ${short.map((s) => `${itemName(catalog, s.itemId)} short by ${s.qty}`).join(', ')}, so your counts may be out of date.`
      : `Made 1 batch of ${itemName(catalog, itemId)}.`)
  }

  const open = orders.filter((o) => o.farmId === farm.id && o.status === 'open')
  const chosen = open.filter((o) => !excluded.has(o.id)).map((o) => o.id)
  const nothing = chosen.length === 0 && topUps.length === 0
  const result = nothing ? null : makePlan({
    catalog, targetFarmId: farm.id, farms, stock, orders, orderIds: chosen, topUps, useOtherFarms,
  })
  const toggle = (id: string) => setExcluded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const farmName = (id: string) => farms.find((f) => f.id === id)?.name ?? id

  return (
    <section className="plan">
      <h1>Plan</h1>

      <h2>Orders in this plan</h2>
      {open.length === 0 && <p className="muted">No open orders on {farm.name}. <Link to="/orders/new">Add an order</Link></p>}
      <ul className="check-list">
        {open.map((o) => (
          <li key={o.id}>
            <label className="toggle">
              <input type="checkbox" checked={!excluded.has(o.id)} onChange={() => toggle(o.id)} />
              {orderLabel(catalog, o)}
            </label>
          </li>
        ))}
      </ul>
      {topUps.length > 0 && (
        <div className="chips" aria-label="Low-stock top-ups">
          {topUps.map((id) => (
            <button key={id} type="button" className="chip" aria-label={`Remove ${itemName(catalog, id)} top-up`} onClick={() => removeTopUp(id)}>
              {itemName(catalog, id)} to minimum <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}
      <label className="toggle">
        <input type="checkbox" checked={useOtherFarms} onChange={(e) => setUseOtherFarms(e.target.checked)} />
        Use other farms
      </label>

      {nothing && <p className="muted">Nothing to plan yet. Tick an order or add a low-stock item.</p>}
      {result && !result.ok && <p className="field-error">A recipe in the catalog loops back on itself. Fix it in the Catalog screen.</p>}
      {notice && <p className="notice" role="status">{notice}</p>}
      {result?.ok && <PlanSections plan={result.plan} catalog={catalog} farm={farm} farmName={farmName}
        onMade={(itemId) => void made(itemId)} />}
    </section>
  )
}

export function PlanSections({ plan, catalog, farm, farmName, onMade }: {
  plan: Plan; catalog: Catalog; farm: Farm; farmName(id: string): string; onMade?(itemId: string): void
}) {
  const name = (id: string) => itemName(catalog, id)
  const allInStock = !plan.transfers.length && !plan.make.length && !plan.plant.length
    && !plan.cantMakeHere.length && !plan.missing.length

  return (
    <>
      {allInStock && <p className="plan-ready">Everything is in stock.</p>}
      {plan.fromStock.length > 0 && (
        <>
          <h2>From stock</h2>
          <ul className="plan-list">{plan.fromStock.map((l) => <li key={l.itemId}>{name(l.itemId)} × {l.qty}</li>)}</ul>
        </>
      )}
      {plan.transfers.length > 0 && (
        <>
          <h2>Transfers</h2>
          <p className="muted">Sell these in the other farm's roadside shop and buy them here, then update both counts.</p>
          <ul className="plan-list">
            {plan.transfers.map((t) => (
              <li key={`${t.fromFarmId}|${t.itemId}`}>{`${farmName(t.fromFarmId)} → ${farm.name}: ${name(t.itemId)} × ${t.qty}`}</li>
            ))}
          </ul>
        </>
      )}
      {plan.make.length > 0 && (
        <>
          <h2>Make</h2>
          <ul className="plan-list">
            {plan.make.map((m) => (
              <li key={m.itemId} aria-label={`${name(m.itemId)} × ${m.batches}`} className="make-row">
                <span className="make-main"><span className="num">{m.batches}</span> × {name(m.itemId)}</span>
                <span className="make-meta">
                  <span>{resourceName(catalog, m.resourceId)}</span>
                  {m.queueRefills !== null && <span>{m.queueRefills === 1 ? '1 refill' : `${m.queueRefills} refills`}</span>}
                </span>
                {onMade && <button type="button" className="btn btn-small" onClick={() => onMade(m.itemId)}>Made 1 batch</button>}
              </li>
            ))}
          </ul>
        </>
      )}
      {plan.plant.length > 0 && (
        <>
          <h2>Plant</h2>
          <ul className="plan-list">{plan.plant.map((p) => <li key={p.itemId}>{`${name(p.itemId)} × ${p.plantings} fields`}</li>)}</ul>
        </>
      )}
      {plan.cantMakeHere.length > 0 && (
        <>
          <h2>Can't make here</h2>
          <p className="muted">Locked on {farm.name}, or it has none of the machine, animal, tree or fields needed.</p>
          <ul className="plan-list">{plan.cantMakeHere.map((l) => <li key={l.itemId}>{name(l.itemId)} × {l.qty}</li>)}</ul>
        </>
      )}
      {plan.missing.length > 0 && (
        <>
          <h2>Missing</h2>
          <p className="muted">These can't be produced on a farm. Get them from the market, a neighbor or the mine.</p>
          <ul className="plan-list">{plan.missing.map((l) => <li key={l.itemId}>{name(l.itemId)} × {l.qty}</li>)}</ul>
        </>
      )}
      {plan.warnings.length > 0 && (
        <>
          <h2>Warnings</h2>
          <ul className="plan-list warnings">{plan.warnings.map((w, i) => <li key={i}>{warningText(catalog, w)}</li>)}</ul>
        </>
      )}
      {plan.time.overallMinutes > 0 && (
        <>
          <h2>Time</h2>
          <p className="plan-time">About {formatMinutes(plan.time.overallMinutes)} (estimate)</p>
          <ul className="plan-list muted">
            {Object.entries(plan.time.perResource).map(([k, m]) => <li key={k}>{resourceName(catalog, k)}: {formatMinutes(m)}</li>)}
          </ul>
        </>
      )}
    </>
  )
}
