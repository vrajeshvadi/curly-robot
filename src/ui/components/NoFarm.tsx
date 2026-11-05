import { Link } from 'react-router-dom'

export function NoFarm() {
  return (
    <section className="empty">
      <p>Add a farm first, then its stock, orders and plans show up here.</p>
      <Link className="btn btn-primary" to="/more/farms/new">Add your first farm</Link>
    </section>
  )
}
