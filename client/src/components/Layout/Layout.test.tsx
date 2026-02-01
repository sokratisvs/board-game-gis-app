import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Layout from './Layout'
import { AuthContext } from '../../context/Auth.context'

jest.mock('../../api/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}))

const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

const defaultContext = {
  user: undefined,
  isLoggedIn: true,
  loginPending: false,
  loginError: undefined,
  setUser: jest.fn(),
  setIsLoggedIn: jest.fn(),
  setLoginPending: jest.fn(),
  setLoginError: jest.fn(),
  register: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  setUserLocation: jest.fn(),
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
    jest.clearAllMocks()
  })

  test('renders main content when logged in', () => {
    renderLayout({ isLoggedIn: true })
    expect(screen.getByText(/Main content/i)).toBeInTheDocument()
  })

  test('renders sidebar and bottom nav when logged in', () => {
    renderLayout({ isLoggedIn: true })
    expect(screen.getByRole('navigation', { name: /primary/i })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /bottom navigation/i })).toBeInTheDocument()
  })

  test('navigates to /login when not logged in', () => {
    renderLayout({ isLoggedIn: false })
    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })
})
