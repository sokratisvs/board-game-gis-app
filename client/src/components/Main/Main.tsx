import { useContext } from 'react'
import MapComponent from '../MapComponent/MapComponent'
import { AuthContext } from '../../context/Auth.context'
import { useNavigate } from 'react-router-dom'
import UpdateLocationComponent from '../UpdateLocation/UpdateLocation'

const Main = () => {
  const { user, logout } = useContext(AuthContext)
  const navigate = useNavigate()

  const onLogout = (e: React.MouseEvent) => {
    e.preventDefault()
    logout(() => navigate('/login'))
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header: greeting + actions */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">
          Hello,{' '}
          <span className="text-sidebar-accent">
            {user?.username || 'User'}
          </span>
        </h1>
        <div className="flex flex-wrap gap-3">
          <UpdateLocationComponent />
          <button
            type="button"
            onClick={onLogout}
            className="
              inline-flex items-center justify-center px-4 py-2
              text-sm font-medium rounded-lg
              bg-slate-300 text-slate-800 border border-slate-400
              hover:bg-slate-400
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400
              transition-colors
            "
          >
            Logout
          </button>
        </div>
      </header>

      {/* Map */}
      <section
        className="rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm"
        aria-label="Map"
      >
        <MapComponent />
      </section>
    </div>
  )
}

export default Main
