import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Login from './Login'
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

const mockLogin = vi.fn()

const defaultContext = {
  user: undefined,
  isLoggedIn: false,
  loginPending: false,
  loginError: undefined,
  setUser: vi.fn(),
  setIsLoggedIn: vi.fn(),
  setLoginPending: vi.fn(),
  setLoginError: vi.fn(),
  register: vi.fn(),
  login: mockLogin,
  logout: vi.fn(),
  setUserLocation: vi.fn(),
}

const renderLogin = (overrides = {}) => {
  const context = { ...defaultContext, ...overrides }
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={context}>
        <Login />
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders login form with email and password inputs', () => {
    renderLogin()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument()
  })

  test('renders Board Game App title and Register link', () => {
    renderLogin()
    expect(screen.getByText(/Board Game App/i)).toBeInTheDocument()
    const registerLink = screen.getByRole('link', { name: /register/i })
    expect(registerLink).toBeInTheDocument()
    expect(registerLink).toHaveAttribute('href', '/register')
  })

  test('updates email and password when typing', async () => {
    renderLogin()
    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    await act(async () => {
      await userEvent.type(emailInput, 'test@example.com')
      await userEvent.type(passwordInput, 'secret123')
    })
    expect(emailInput).toHaveValue('test@example.com')
    expect(passwordInput).toHaveValue('secret123')
  })

  test('calls login with email and password on submit', async () => {
    mockLogin.mockImplementation((email, password, callback) => {
      Promise.resolve().then(() => callback(null))
    })
    renderLogin()
    await act(async () => {
      await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com')
      await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
      await userEvent.click(screen.getByRole('button', { name: /login/i }))
    })
    expect(mockLogin).toHaveBeenCalledWith(
      'test@example.com',
      'secret123',
      expect.any(Function)
    )
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))
  })

  test('navigates to / on successful login', async () => {
    mockLogin.mockImplementation((email, password, callback) => {
      Promise.resolve().then(() => callback(null))
    })
    renderLogin()
    await act(async () => {
      await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com')
      await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
      await userEvent.click(screen.getByRole('button', { name: /login/i }))
    })
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))
  })

  test('shows login error when loginError is set', () => {
    renderLogin({
      loginError: { message: 'Invalid credentials' },
    })
    expect(screen.getByText(/Invalid credentials/i)).toBeInTheDocument()
  })

  test('shows generic error when loginError has no message', () => {
    renderLogin({ loginError: {} })
    expect(screen.getByText(/Login failed/i)).toBeInTheDocument()
  })

  test('submit button is disabled when loginPending', () => {
    renderLogin({ loginPending: true })
    expect(screen.getByRole('button', { name: /logging in/i })).toBeDisabled()
  })

  test('shows Logging in... when loginPending', () => {
    renderLogin({ loginPending: true })
    expect(
      screen.getByRole('button', { name: /logging in/i })
    ).toBeInTheDocument()
  })
})
