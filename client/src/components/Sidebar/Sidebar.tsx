import { Link, useLocation } from 'react-router-dom'
import { useContext } from 'react'
import { AuthContext } from '../../context/Auth.context'
import PathConstants from '../../routes/pathConstants'

const menuItemsOrder = [
  { label: 'Dashboard', path: PathConstants.DASHBOARD, adminOnly: true },
  { label: 'Users', path: PathConstants.USERS, adminOnly: false },
  { label: 'Map', path: PathConstants.MAP, adminOnly: false },
  { label: 'Settings', path: PathConstants.SETTINGS, adminOnly: false },
]

type SidebarProps = {
  open: boolean
  onToggle: () => void
}

const Sidebar = ({ open, onToggle }: SidebarProps) => {
  const location = useLocation()
  const { user } = useContext(AuthContext)
  const isAdmin = user?.role === 'admin'
  const menuItems = menuItemsOrder.filter((item) => !item.adminOnly || isAdmin)

  return (
    <aside
      className={`
        fixed top-0 left-0 z-40 h-full
        bg-sidebar text-white
        flex flex-col
        transition-[width] duration-300 ease-out
        ${open ? 'w-64' : 'w-20'}
      `}
      aria-label="Main navigation"
    >
      <div className="flex items-center h-14 shrink-0 border-b border-white/10 px-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
          className="
            flex items-center justify-center w-10 h-10 rounded-lg
            text-white hover:bg-sidebar-hover
            focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sidebar-accent
          "
        >
          <span className="text-xl" aria-hidden="true">
            ☰
          </span>
        </button>
        {open && (
          <span className="ml-2 text-sm font-semibold truncate">
            Board Game GIS
          </span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4" aria-label="Primary">
        <ul className="space-y-1 px-2">
          {menuItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path))
            return (
              <li key={item.label}>
                <Link
                  to={item.path}
                  aria-label={item.label}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                    transition-colors
                    focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sidebar-accent focus:rounded-lg
                    ${
                      isActive
                        ? 'bg-sidebar-hover text-sidebar-accent'
                        : 'text-slate-300 hover:bg-sidebar-hover hover:text-white'
                    }
                    ${!open ? 'justify-center px-0' : ''}
                  `}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="shrink-0 w-6 text-center" aria-hidden="true">
                    {item.label === 'Map' && '🗺️'}
                    {item.label === 'Users' && '👥'}
                    {item.label === 'Dashboard' && '📊'}
                    {item.label === 'Settings' && '⚙️'}
                  </span>
                  {open && <span>{item.label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}

export default Sidebar
