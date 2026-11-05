import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ingredientsOf } from '../../catalog/build'
import { validateItemEdit } from '../../catalog/validate'
import { deleteOverride, saveCustomItem, saveOverride } from '../../data/repo'
import type { Catalog, Category, CatalogIssue, Ingredient, Item, Storage } from '../../types'
import { useDb, useSeed } from '../AppState'
import { CountField } from '../components/CountField'
import { ItemPicker } from '../components/ItemPicker'
import { itemName } from '../itemOrder'
import { useLoadedCatalog } from '../useCatalog'

type Draft = {
  name: string
  unlockLevel: number
  storage: Storage
  madeBy: string // "field" | "machine:<id>" | "animal:<id>" | "tree:<id>" | "none"
  minutes: number
  seedUsed: number
  harvestYield: number
  yield: number
  ingredients: Ingredient[]
}

function toDraft(item: Item): Draft {
  const s = item.source
  return {
    name: item.name,
    unlockLevel: item.unlockLevel,
    storage: item.storage,
    madeBy: s.kind === 'field' || s.kind === 'none' ? s.kind
      : s.kind === 'machine' ? `machine:${s.machineId}` : s.kind === 'animal' ? `animal:${s.animalId}` : `tree:${s.treeId}`,
    minutes: s.kind === 'none' ? 10 : s.minutes,
    seedUsed: s.kind === 'field' ? s.seedUsed : 1,
    harvestYield: s.kind === 'field' ? s.harvestYield : 2,
    yield: s.kind === 'machine' || s.kind === 'animal' || s.kind === 'tree' ? s.yield : 1,
    ingredients: ingredientsOf(item),
  }
}

const CATEGORY: Record<string, Category> = { field: 'crop', tree: 'tree', animal: 'animal', machine: 'made', none: 'material' }

function fromDraft(id: string, d: Draft): Item {
  const [kind, ref] = d.madeBy.split(':')
  const ingredients = d.ingredients.filter((i) => i.qty > 0)
  const source: Item['source'] =
    kind === 'field' ? { kind: 'field', seedUsed: d.seedUsed, harvestYield: d.harvestYield, minutes: d.minutes }
    : kind === 'machine' ? { kind: 'machine', machineId: ref, yield: d.yield, minutes: d.minutes, ingredients }
    : kind === 'animal' ? { kind: 'animal', animalId: ref, yield: d.yield, minutes: d.minutes, ingredients }
    : kind === 'tree' ? { kind: 'tree', treeId: ref, yield: d.yield, minutes: d.minutes }
    : { kind: 'none' }
  return { id, name: d.name.trim(), category: CATEGORY[kind], storage: d.storage, unlockLevel: d.unlockLevel, source }
}

function newId(catalog: Catalog, name: string): string {
  const base = name.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'item'
  let id = base
  for (let n = 2; catalog.items[id]; n++) id = `${base}_${n}`
  return id
}

export function ItemEditorScreen() {
  const { itemId = 'new' } = useParams()
  const catalog = useLoadedCatalog()
  const db = useDb()
  const custom = useLiveQuery(async () => (await db.customItems.get(itemId)) ?? null, [db, itemId])
  if (custom === undefined || !catalog) return null
  if (itemId === 'new') {
    const first = Object.values(catalog.machines)[0]
    const blank: Item = { id: '', name: '', category: 'made', storage: 'barn', unlockLevel: 1,
      source: first ? { kind: 'machine', machineId: first.id, yield: 1, minutes: 10, ingredients: [] } : { kind: 'none' } }
    return <ItemEditor key="new" catalog={catalog} initial={blank} mode="new" />
  }
  const item = catalog.items[itemId]
  if (!item) return <p>This item isn't in the catalog.</p>
  return <ItemEditor key={item.id} catalog={catalog} initial={item} mode={custom ? 'custom' : 'seed'} />
}

function ItemEditor({ catalog, initial, mode }: { catalog: Catalog; initial: Item; mode: 'new' | 'custom' | 'seed' }) {
  const db = useDb()
  const seed = useSeed()
  const navigate = useNavigate()
  const [d, setD] = useState<Draft>(() => toDraft(initial))
  const [issues, setIssues] = useState<CatalogIssue[]>([])
  const [invalid, setInvalid] = useState<Set<string>>(new Set())
  const [nameError, setNameError] = useState(false)
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }))
  const validity = (key: string) => (ok: boolean) =>
    setInvalid((s) => { const n = new Set(s); if (ok) n.delete(key); else n.add(key); return n })

  const kind = d.madeBy.split(':')[0]
  const hasIngredients = kind === 'machine' || kind === 'animal'

  const save = async () => {
    if (!d.name.trim()) { setNameError(true); return }
    if (invalid.size) return
    const id = mode === 'new' ? newId(catalog, d.name) : initial.id
    const item = fromDraft(id, d)
    const found = validateItemEdit(catalog, item)
    setIssues(found)
    if (found.length) return
    if (mode === 'seed') {
      // Saving an item back to its original values removes the edit instead of storing a copy.
      if (JSON.stringify(seed.items[id]) === JSON.stringify(item)) await deleteOverride(db, id)
      else await saveOverride(db, { itemId: id, item })
    } else {
      await saveCustomItem(db, item)
    }
    navigate(`/more/catalog/${id}`)
  }

  const resources = [
    ...Object.values(catalog.machines).map((m) => ({ value: `machine:${m.id}`, label: m.name })),
    ...Object.values(catalog.animals).map((a) => ({ value: `animal:${a.id}`, label: `${a.name} (animal)` })),
    ...Object.values(catalog.trees).map((t) => ({ value: `tree:${t.id}`, label: t.name })),
  ]

  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); void save() }}>
      <h1>{mode === 'new' ? 'Add item' : `Edit ${initial.name}`}</h1>

      <div className="field">
        <label htmlFor="item-name">Name</label>
        <input id="item-name" value={d.name} onChange={(e) => { set({ name: e.target.value }); setNameError(false) }} aria-invalid={nameError || undefined} />
        {nameError && <span className="field-error">Give the item a name</span>}
      </div>

      <div className="field">
        <label htmlFor="item-made-by">Made by</label>
        <select id="item-made-by" value={d.madeBy} onChange={(e) => set({ madeBy: e.target.value })}>
          <option value="field">Fields</option>
          {resources.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          <option value="none">Not produced (material, ore, fish)</option>
        </select>
      </div>

      <div className="field-grid">
        <CountField label="Unlock level" value={d.unlockLevel} onChange={(n) => set({ unlockLevel: n })} onValidity={validity('level')} />
        <div className="field">
          <label htmlFor="item-storage">Storage</label>
          <select id="item-storage" value={d.storage} onChange={(e) => set({ storage: e.target.value as Storage })}>
            <option value="barn">Barn</option>
            <option value="silo">Silo</option>
          </select>
        </div>
        {kind !== 'none' && <CountField label="Time in minutes" value={d.minutes} onChange={(n) => set({ minutes: n })} onValidity={validity('minutes')} />}
        {kind === 'field' && <CountField label="Seed used" value={d.seedUsed} onChange={(n) => set({ seedUsed: n })} onValidity={validity('seed')} />}
        {kind === 'field' && <CountField label="Harvest" value={d.harvestYield} onChange={(n) => set({ harvestYield: n })} onValidity={validity('harvest')} />}
        {(kind === 'machine' || kind === 'animal' || kind === 'tree') &&
          <CountField label="Makes per batch" value={d.yield} onChange={(n) => set({ yield: n })} onValidity={validity('yield')} />}
      </div>

      {hasIngredients && (
        <fieldset>
          <legend>Needs</legend>
          <ul className="rows line-rows">
            {d.ingredients.map((ing, idx) => {
              const n = itemName(catalog, ing.itemId)
              return (
                <li key={`${ing.itemId}-${idx}`} className="line-row">
                  <span className="item-name">{n}</span>
                  <CountField label={`${n} needed`} hideLabel value={ing.qty} onValidity={validity(`ing:${ing.itemId}`)}
                    onChange={(q) => set({ ingredients: d.ingredients.map((x, j) => (j === idx ? { ...x, qty: q } : x)) })} />
                  <button type="button" className="icon-btn" aria-label={`Remove ${n}`}
                    onClick={() => set({ ingredients: d.ingredients.filter((_, j) => j !== idx) })}>×</button>
                </li>
              )
            })}
          </ul>
          <ItemPicker farm={null} label="Add ingredient"
            onPick={(id) => set({ ingredients: d.ingredients.some((x) => x.itemId === id) ? d.ingredients : [...d.ingredients, { itemId: id, qty: 1 }] })} />
        </fieldset>
      )}

      {issues.length > 0 && (
        <ul className="plan-list warnings" role="alert">
          {issues.map((i, k) => <li key={k}>{i.detail}</li>)}
        </ul>
      )}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary">Save item</button>
        <button type="button" className="btn" onClick={() => navigate(-1)}>Cancel</button>
      </div>
    </form>
  )
}
