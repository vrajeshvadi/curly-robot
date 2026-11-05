import { Link } from 'react-router-dom'

const links = [
  { to: '/more/calculator', label: 'Calculator', note: 'Everything one item needs, down to raw crops' },
  { to: '/more/catalog', label: 'Catalog', note: 'Items, machines and recipes; fix or add your own' },
  { to: '/more/farms', label: 'Farms', note: 'Main and baby farms, levels and capacity' },
  { to: '/more/backup', label: 'Backup', note: 'Save your data to a file or restore it' },
]

export function More() {
  return (
    <section>
      <h1>More</h1>
      <ul className="rows">
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="row-link more-link">
              <span className="item-name">{l.label}</span>
              <span className="muted">{l.note}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
