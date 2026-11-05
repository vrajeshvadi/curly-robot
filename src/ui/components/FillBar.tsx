export function FillBar({ label, used, capacity }: { label: string; used: number; capacity: number }) {
  const pct = capacity > 0 ? Math.min(100, Math.round((used / capacity) * 100)) : 100
  const tone = used > capacity ? 'over' : pct >= 90 ? 'near' : 'ok'
  return (
    <div className={`fill-bar fill-${tone}`}>
      <div className="fill-text"><span>{label} {used} / {capacity}</span></div>
      <div className="fill-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={used}>
        <div className="fill-value" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
