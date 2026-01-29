import { Suspense, useContext, useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { AuthContext } from '../../context/Auth.context'
import Sidebar from '../Sidebar/Sidebar'
import BottomNav from '../BottomNav/BottomNav'

export default function Layout() {
  const { isLoggedIn } = useContext(AuthContext)
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login')
    }
  }, [navigate, isLoggedIn])

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
          pt-4 px-4 pb-24 md:pb-6 md:pt-6 md:px-6
          ${sidebarOpen ? 'md:ml-64' : 'md:ml-20'}
        `}
      >
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
