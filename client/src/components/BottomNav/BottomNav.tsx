import { Link, useLocation } from 'react-router-dom'
import PathConstants from '../../routes/pathConstants'

const navItems = [
  { label: 'Map', path: PathConstants.MAIN, icon: '🗺️' },
  { label: 'Users', path: PathConstants.USERS, icon: '👥' },
  { label: 'Settings', path: PathConstants.SETTINGS, icon: '⚙️' },
]

export default function BottomNav() {
  const location = useLocation()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden bg-white border-t border-slate-200 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]"
      aria-label="Bottom navigation"
    >
      <ul className="flex flex-1 justify-around">
        {navItems.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path))
          return (
            <li key={item.label} className="flex-1">
              <Link
                to={item.path}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={`
                  flex flex-col items-center justify-center gap-0.5 py-3 px-1 min-h-[56px]
                  text-xs font-medium transition-colors
                  focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary
                  ${isActive ? 'text-primary' : 'text-slate-500'}
                `}
              >
                <span className="text-lg" aria-hidden="true">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
