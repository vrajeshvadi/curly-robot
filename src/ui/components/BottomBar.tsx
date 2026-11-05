import { NavLink } from 'react-router-dom'

const tabs: { to: string; label: string; icon: string }[] = [
  { to: '/', label: 'Home', icon: 'M3 11 12 4l9 7v9h-6v-6H9v6H3z' },
  { to: '/stock', label: 'Stock', icon: 'M3 9 12 4l9 5v11H3zM7 20v-7h10v7M7 16h10' },
  { to: '/orders', label: 'Orders', icon: 'M2 7h12v9H2zM14 10h4l3 3v3h-7M5 19a2 2 0 1 0 0-.1M17 19a2 2 0 1 0 0-.1' },
  { to: '/plan', label: 'Plan', icon: 'M6 3h12v18H6zM9 8h6M9 12h6M9 16h4' },
  { to: '/more', label: 'More', icon: 'M5 12h.01M12 12h.01M19 12h.01' },
]

export function BottomBar() {
  return (
    <nav className="bottom-bar" aria-label="Main">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'} className="tab">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={t.icon} /></svg>
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
