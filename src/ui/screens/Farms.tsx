import { Link } from 'react-router-dom'
import { useFarms } from '../useData'

export function Farms() {
  const farms = useFarms()
  if (!farms) return null
  return (
    <section>
      <h1>Farms</h1>
      <ul className="rows">
        {farms.map((f) => (
          <li key={f.id}>
            <Link to={`/more/farms/${f.id}`} className="row-link">
              <span>{f.name}</span>
              <span className="muted">Level {f.level}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link className="btn btn-primary" to="/more/farms/new">Add farm</Link>
    </section>
  )
}
