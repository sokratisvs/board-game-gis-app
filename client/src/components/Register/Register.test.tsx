import { render, screen, within, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Register from './Register'
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

const mockRegister = vi.fn()

const defaultContext = {
  user: undefined,
  isLoggedIn: false,
  loginPending: false,
  loginError: undefined,
  setUser: vi.fn(),
  setIsLoggedIn: vi.fn(),
  setLoginPending: vi.fn(),
  setLoginError: vi.fn(),
  register: mockRegister,
  login: vi.fn(),
  logout: vi.fn(),
  setUserLocation: vi.fn(),
}

const renderRegister = (overrides = {}) => {
  const context = { ...defaultContext, ...overrides }
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={context}>
        <Register />
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

describe('Register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders register form with name, email, password, and type select', () => {
    renderRegister()
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/select user type/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument()
  })

  test('renders Board Game App title and Login link', () => {
    renderRegister()
    expect(screen.getByText(/Board Game App/i)).toBeInTheDocument()
    const loginLink = screen.getByRole('link', { name: /login/i })
    expect(loginLink).toBeInTheDocument()
    expect(loginLink).toHaveAttribute('href', '/login')
  })

  test('updates inputs when typing and select when choosing type', async () => {
    renderRegister()
    await act(async () => {
      await userEvent.type(screen.getByLabelText(/full name/i), 'Jane Doe')
      await userEvent.type(
        screen.getByLabelText(/username/i),
        'jane@example.com'
      )
      await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
      await userEvent.selectOptions(
        screen.getByLabelText(/select user type/i),
        'user'
      )
    })
    expect(screen.getByLabelText(/full name/i)).toHaveValue('Jane Doe')
    expect(screen.getByLabelText(/username/i)).toHaveValue('jane@example.com')
    expect(screen.getByLabelText(/password/i)).toHaveValue('secret123')
    expect(screen.getByLabelText(/select user type/i)).toHaveValue('user')
  })

  test('Sign Up button is disabled when no type selected', () => {
    renderRegister()
    expect(screen.getByRole('button', { name: /sign up/i })).toBeDisabled()
  })

  test('Sign Up button is enabled when type is selected', async () => {
    renderRegister()
    await act(async () => {
      await userEvent.selectOptions(
        screen.getByLabelText(/select user type/i),
        'user'
      )
    })
    expect(screen.getByRole('button', { name: /sign up/i })).not.toBeDisabled()
  })

  test('calls register with name, email, password, type, callback on submit', async () => {
    mockRegister.mockImplementation((name, email, password, type, callback) => {
      Promise.resolve().then(() => callback(null))
    })
    renderRegister()
    await act(async () => {
      await userEvent.type(screen.getByLabelText(/full name/i), 'Jane Doe')
      await userEvent.type(
        screen.getByLabelText(/username/i),
        'jane@example.com'
      )
      await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
      await userEvent.selectOptions(
        screen.getByLabelText(/select user type/i),
        'shop'
      )
      await userEvent.click(screen.getByRole('button', { name: /sign up/i }))
    })
    expect(mockRegister).toHaveBeenCalledWith(
      'Jane Doe',
      'jane@example.com',
      'secret123',
      'shop',
      expect.any(Function)
    )
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'))
  })

  test('navigates to /login on successful registration', async () => {
    mockRegister.mockImplementation((name, email, password, type, callback) => {
      Promise.resolve().then(() => callback(null))
    })
    renderRegister()
    await act(async () => {
      await userEvent.type(screen.getByLabelText(/full name/i), 'Jane Doe')
      await userEvent.type(
        screen.getByLabelText(/username/i),
        'jane@example.com'
      )
      await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
      await userEvent.selectOptions(
        screen.getByLabelText(/select user type/i),
        'user'
      )
      await userEvent.click(screen.getByRole('button', { name: /sign up/i }))
    })
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'))
  })

  test('shows registration error when loginError is set', () => {
    renderRegister({
      loginError: { message: 'Email already in use' },
    })
    expect(screen.getByText(/Email already in use/i)).toBeInTheDocument()
  })

  test('shows generic error when loginError has no message', () => {
    renderRegister({ loginError: {} })
    expect(screen.getByText(/Registration failed/i)).toBeInTheDocument()
  })

  test('submit button is disabled when loginPending', async () => {
    renderRegister({ loginPending: true })
    await act(async () => {
      await userEvent.selectOptions(
        screen.getByLabelText(/select user type/i),
        'user'
      )
    })
    expect(screen.getByRole('button', { name: /signing up/i })).toBeDisabled()
  })

  test('shows Signing up... when loginPending', async () => {
    renderRegister({ loginPending: true })
    await act(async () => {
      await userEvent.selectOptions(
        screen.getByLabelText(/select user type/i),
        'user'
      )
    })
    expect(
      screen.getByRole('button', { name: /signing up/i })
    ).toBeInTheDocument()
  })

  test('user type options include user, shop, event, admin', () => {
    renderRegister()
    const select = screen.getByLabelText(/select user type/i)
    expect(within(select).getByText('User')).toBeInTheDocument()
    expect(within(select).getByText('Shop')).toBeInTheDocument()
    expect(within(select).getByText('Event')).toBeInTheDocument()
    expect(within(select).getByText('Admin')).toBeInTheDocument()
  })
})
