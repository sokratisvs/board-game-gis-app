import { render, screen, within, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Register from './Register'
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

const mockRegister = jest.fn()

const defaultContext = {
  user: undefined,
  isLoggedIn: false,
  loginPending: false,
  loginError: undefined,
  setUser: jest.fn(),
  setIsLoggedIn: jest.fn(),
  setLoginPending: jest.fn(),
  setLoginError: jest.fn(),
  register: mockRegister,
  login: jest.fn(),
  logout: jest.fn(),
  setUserLocation: jest.fn(),
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
    jest.clearAllMocks()
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

  test('calls register with name, email, password, callback, type on submit', async () => {
    mockRegister.mockImplementation((name, email, password, callback, type) => {
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
      expect.any(Function),
      'shop'
    )
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'))
  })

  test('navigates to /login on successful registration', async () => {
    mockRegister.mockImplementation((name, email, password, callback, type) => {
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
