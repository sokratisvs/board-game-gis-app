import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Layout from './Layout'
import { AuthContext } from '../../context/Auth.context'

vi.mock('../../api/axios', () => ({
  __esModule: true,
  default: { get: vi.fn(), post: vi.fn() },
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom'
  )),
  useNavigate: () => mockNavigate,
}))

const defaultContext = {
  user: {
    userId: '1',
    username: 'TestUser',
    coordinates: [0, 0] as [number, number],
    type: 'myLocation' as const,
    role: 'user' as const,
  },
  isLoggedIn: true,
  loginPending: false,
  loginError: undefined,
  setUser: vi.fn(),
  setIsLoggedIn: vi.fn(),
  setLoginPending: vi.fn(),
  setLoginError: vi.fn(),
  register: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  setUserLocation: vi.fn(),
}

const renderLayout = (overrides = {}) => {
  const context = { ...defaultContext, ...overrides }
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AuthContext.Provider value={context}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<div>Main content</div>} />
          </Route>
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders main content when logged in', () => {
    renderLayout({ isLoggedIn: true })
    expect(screen.getByText(/Main content/i)).toBeInTheDocument()
  })

  test('renders shared header (greeting + Logout) when logged in', () => {
    renderLayout({ isLoggedIn: true })
    expect(screen.getByText(/Hello,/i)).toBeInTheDocument()
    expect(screen.getByText(/TestUser/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument()
  })

  test('renders sidebar and bottom nav when logged in', () => {
    renderLayout({ isLoggedIn: true })
    expect(
      screen.getByRole('navigation', { name: /primary/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('navigation', { name: /bottom navigation/i })
    ).toBeInTheDocument()
  })

  test('navigates to /login when not logged in', () => {
    renderLayout({ isLoggedIn: false })
    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })
})
