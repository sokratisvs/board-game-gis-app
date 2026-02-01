import React, { Suspense, useContext, useEffect, useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { AuthContext } from '../../context/Auth.context'
import PathConstants from '../../routes/pathConstants'
import Sidebar from '../Sidebar/Sidebar'
import BottomNav from '../BottomNav/BottomNav'
import UpdateLocationComponent from '../UpdateLocation/UpdateLocation'

const SIDEBAR_EXPAND_BREAKPOINT_PX = 1200
const MEDIA_EXPAND = `(min-width: ${SIDEBAR_EXPAND_BREAKPOINT_PX}px)`

export default function Layout() {
  const { isLoggedIn, user, logout } = useContext(AuthContext)
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isMapPage = location.pathname === PathConstants.MAP

  // Expand sidebar by default only for viewport >= 1200px; sync on resize
  useEffect(() => {
    const m = window.matchMedia(MEDIA_EXPAND)
    const update = () => setSidebarOpen(m.matches)
    update()
    m.addEventListener('change', update)
    return () => m.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login')
    }
  }, [navigate, isLoggedIn])

  const onLogout = (e: React.MouseEvent) => {
    e.preventDefault()
    logout(() => navigate('/login'))
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar: desktop only */}
      <div className="hidden md:block">
        <Sidebar
          open={sidebarOpen}
          onToggle={() => setSidebarOpen((o) => !o)}
        />
      </div>

      <main
        className={`
          flex-1 min-w-0 transition-[margin] duration-300 ease-out
          pt-4 px-3 pb-24 md:pb-6 md:pt-6 md:px-6
          ${sidebarOpen ? 'md:ml-64' : 'md:ml-20'}
        `}
      >
        {/* Shared header: greeting + (Update Location on Map only) + Logout */}
        <header
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4 md:mb-6"
          aria-label="User actions"
        >
          <h1 className="text-2xl font-bold text-sidebar m-0">
            Hello,{' '}
            <span className="text-sidebar-accent">
              {user?.username || 'User'}
            </span>
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            {isMapPage && <UpdateLocationComponent />}
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

        <Suspense
          fallback={
            <div
              className="flex items-center justify-center min-h-[200px] text-slate-500"
              role="status"
              aria-live="polite"
            >
              Loading…
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>

      {/* Bottom nav: mobile only */}
      <BottomNav />
    </div>
  )
}
