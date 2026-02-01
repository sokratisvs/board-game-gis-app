import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Main from './Main'
import { AuthContext } from '../../context/Auth.context'

jest.mock('../../api/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}))

jest.mock('../MapComponent/MapComponent', () => {
  return function MockMapComponent() {
    return <div data-testid="map-component">Map</div>
  }
})

const mockNavigate = jest.fn()
const mockLogout = jest.fn()
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

const defaultContext = {
  user: {
    userId: '1',
    username: 'TestUser',
    coordinates: [0, 0] as [number, number],
    type: 'myLocation' as const,
  },
  isLoggedIn: true,
  loginPending: false,
  loginError: undefined,
  setUser: jest.fn(),
  setIsLoggedIn: jest.fn(),
  setLoginPending: jest.fn(),
  setLoginError: jest.fn(),
  register: jest.fn(),
  login: jest.fn(),
  logout: mockLogout,
  setUserLocation: jest.fn(),
}

const renderMain = (overrides = {}) => {
  const context = { ...defaultContext, ...overrides }
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={context}>
        <Main />
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

describe('Main', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('renders greeting with username', () => {
    renderMain()
    expect(screen.getByText(/Hello,/i)).toBeInTheDocument()
    expect(screen.getByText(/TestUser/i)).toBeInTheDocument()
  })

  test('renders User when user is undefined', () => {
    renderMain({ user: undefined })
    expect(screen.getByText(/User/i)).toBeInTheDocument()
  })

  test('renders Update Location button and Logout button', () => {
    renderMain()
    expect(
      screen.getByRole('button', { name: /update location/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument()
  })

  test('renders map section', () => {
    renderMain()
    expect(screen.getByTestId('map-component')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /map/i })).toBeInTheDocument()
  })

  test('calls logout and navigates to /login when Logout clicked', async () => {
    mockLogout.mockImplementation((cb) => cb())
    renderMain()
    await userEvent.click(screen.getByRole('button', { name: /logout/i }))
    expect(mockLogout).toHaveBeenCalledWith(expect.any(Function))
    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })
})
