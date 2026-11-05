import { useState } from 'react'
import { calculate } from '../../planner/plan'
import type { Farm, ItemId } from '../../types'
import { CountField } from '../components/CountField'
import { ItemPicker } from '../components/ItemPicker'
import { NoFarm } from '../components/NoFarm'
import { itemName } from '../itemOrder'
import { useCatalog } from '../useCatalog'
import { useCurrentFarm, useFarms, useOrders, useStock } from '../useData'
import { PlanSections } from './Plan'

export function CalculatorScreen() {
  const farm = useCurrentFarm()
  if (farm === undefined) return null
  if (farm === null) return <NoFarm />
  return <Calculator farm={farm} />
}

function Calculator({ farm }: { farm: Farm }) {
  const catalog = useCatalog()
  const farms = useFarms()
  const stock = useStock()
  const orders = useOrders()
  const [itemId, setItemId] = useState<ItemId | null>(null)
  const [qty, setQty] = useState(1)
  const [mode, setMode] = useState<'empty' | 'mine'>('empty')
  if (!farms || !stock || !orders) return null

  const result = itemId && qty > 0 ? calculate(catalog, farm, itemId, qty, mode, { farms, stock, orders }) : null

  return (
    <section>
      <h1>Calculator</h1>
      {itemId ? (
        <div className="calc-item">
          <span className="item-name calc-name">{itemName(catalog, itemId)}</span>
          <button type="button" className="btn btn-small" onClick={() => setItemId(null)}>Change item</button>
        </div>
      ) : (
        <ItemPicker farm={farm} onPick={setItemId} />
      )}
      <div className="field-grid">
        <CountField label="Quantity" value={qty} onChange={setQty} />
      </div>
      <div className="segmented" role="group" aria-label="Stock to use">
        <button type="button" aria-pressed={mode === 'empty'} onClick={() => setMode('empty')}>Empty stock</button>
        <button type="button" aria-pressed={mode === 'mine'} onClick={() => setMode('mine')}>My stock</button>
      </div>
      <p className="muted">
        {mode === 'empty' ? 'Everything made from scratch on ' : 'Uses what is in stock on '}{farm.name}.
      </p>
      {result && !result.ok && <p className="field-error">A recipe in the catalog loops back on itself. Fix it in the Catalog screen.</p>}
      {result?.ok && <PlanSections plan={result.plan} catalog={catalog} farm={farm} farmName={(id) => id} />}
    </section>
  )
}
