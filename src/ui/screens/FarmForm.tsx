import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { deleteFarm, saveFarm } from '../../data/repo'
import { newFarm } from '../../lib/newFarm'
import type { Catalog, Farm, Resource } from '../../types'
import { useAppState, useDb } from '../AppState'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { CountField } from '../components/CountField'
import { useCatalog } from '../useCatalog'
import { useFarms } from '../useData'

export function FarmFormScreen() {
  const { id } = useParams()
  const farms = useFarms()
  const catalog = useCatalog()
  if (!farms) return null
  if (id === 'new') return <FarmForm key="new" catalog={catalog} isNew initial={newFarm(catalog, '', 1)} />
  const farm = farms.find((f) => f.id === id)
  if (!farm) return <p>That farm no longer exists.</p>
  return <FarmForm key={farm.id} catalog={catalog} isNew={false} initial={farm} />
}

function byLevel(r: Record<string, Resource>) {
  return Object.values(r).sort((a, b) => a.unlockLevel - b.unlockLevel || a.name.localeCompare(b.name))
}

function FarmForm({ catalog, initial, isNew }: { catalog: Catalog; initial: Farm; isNew: boolean }) {
  const db = useDb()
  const navigate = useNavigate()
  const { setFarmId } = useAppState()
  const [farm, setFarm] = useState<Farm>(initial)
  const [showLocked, setShowLocked] = useState(false)
  const [invalid, setInvalid] = useState<Set<string>>(new Set())
  const [nameError, setNameError] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const validity = (key: string) => (ok: boolean) =>
    setInvalid((s) => { const n = new Set(s); if (ok) n.delete(key); else n.add(key); return n })
  const set = (patch: Partial<Farm>) => setFarm((f) => ({ ...f, ...patch }))
  const visible = (r: Resource) => showLocked || r.unlockLevel <= farm.level

  const setLevel = (level: number) =>
    setFarm((f) => ({
      ...f,
      level,
      // A new farm's machines follow its level until saved.
      machines: isNew
        ? Object.fromEntries(Object.entries(f.machines).map(([k, m]) => [k, { ...m, owned: (catalog.machines[k]?.unlockLevel ?? 1) <= level }]))
        : f.machines,
    }))

  const save = async () => {
    const name = farm.name.trim()
    if (!name) { setNameError(true); return }
    if (invalid.size) return
    await saveFarm(db, { ...farm, name })
    setFarmId(farm.id)
    navigate('/more/farms')
  }

  const remove = async () => {
    await deleteFarm(db, farm.id)
    navigate('/more/farms')
  }

  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); void save() }}>
      <h1>{isNew ? 'Add farm' : farm.name}</h1>

      <div className="field">
        <label htmlFor="farm-name">Farm name</label>
        <input id="farm-name" value={farm.name} onChange={(e) => { set({ name: e.target.value }); setNameError(false) }}
          aria-invalid={nameError || undefined} placeholder="Main, Baby 1…" />
        {nameError && <span className="field-error">Give the farm a name</span>}
      </div>

      <div className="field-grid">
        <CountField label="Level" value={farm.level} onChange={setLevel} onValidity={validity('level')} />
        <CountField label="Fields" value={farm.fields} onChange={(n) => set({ fields: n })} onValidity={validity('fields')} />
        <CountField label="Barn capacity" value={farm.barnCapacity} onChange={(n) => set({ barnCapacity: n })} onValidity={validity('barn')} />
        <CountField label="Silo capacity" value={farm.siloCapacity} onChange={(n) => set({ siloCapacity: n })} onValidity={validity('silo')} />
      </div>

      <label className="toggle">
        <input type="checkbox" checked={showLocked} onChange={(e) => setShowLocked(e.target.checked)} />
        Show locked
      </label>

      <fieldset>
        <legend>Machines</legend>
        {byLevel(catalog.machines).filter(visible).map((m) => {
          const cur = farm.machines[m.id] ?? { owned: false, slots: 2 }
          return (
            <div className="resource-row" key={m.id}>
              <label className="toggle">
                <input type="checkbox" checked={cur.owned}
                  onChange={(e) => set({ machines: { ...farm.machines, [m.id]: { ...cur, owned: e.target.checked } } })} />
                {m.name}
              </label>
              <CountField label={`${m.name} slots`} hideLabel value={cur.slots}
                onChange={(n) => set({ machines: { ...farm.machines, [m.id]: { ...cur, slots: n } } })}
                onValidity={validity(`m:${m.id}`)} />
            </div>
          )
        })}
      </fieldset>

      <fieldset>
        <legend>Animals</legend>
        {byLevel(catalog.animals).filter(visible).map((a) => (
          <CountField key={a.id} label={a.name} value={farm.animals[a.id] ?? 0}
            onChange={(n) => set({ animals: { ...farm.animals, [a.id]: n } })} onValidity={validity(`a:${a.id}`)} />
        ))}
      </fieldset>

      <fieldset>
        <legend>Trees and bushes</legend>
        {byLevel(catalog.trees).filter(visible).map((t) => (
          <CountField key={t.id} label={t.name} value={farm.trees[t.id] ?? 0}
            onChange={(n) => set({ trees: { ...farm.trees, [t.id]: n } })} onValidity={validity(`t:${t.id}`)} />
        ))}
      </fieldset>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary">Save farm</button>
        {!isNew && <button type="button" className="btn btn-danger-quiet" onClick={() => setConfirming(true)}>Delete farm</button>}
      </div>

      {confirming && (
        <ConfirmDialog title={`Delete ${farm.name}?`} confirmLabel={`Delete ${farm.name}`} danger
          onConfirm={() => void remove()} onCancel={() => setConfirming(false)}>
          <p>Its stock and orders will be deleted too.</p>
        </ConfirmDialog>
      )}
    </form>
  )
}
