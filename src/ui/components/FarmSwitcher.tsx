import { useAppState } from '../AppState'
import { useFarms } from '../useData'

export function FarmSwitcher() {
  const farms = useFarms()
  const { farmId, setFarmId } = useAppState()
  if (!farms?.length || !farmId) return <span className="brand">Hay Day Manager</span>
  return (
    <label className="farm-switcher">
      <span className="visually-hidden">Farm</span>
      <select value={farmId} onChange={(e) => setFarmId(e.target.value)} aria-label="Farm">
        {farms.map((f) => (
          <option key={f.id} value={f.id}>{f.name}</option>
        ))}
      </select>
    </label>
  )
}
