import React from 'react'
import { render, screen } from '@testing-library/react'
import MyLocation from './MyLocation'
import { AuthContext } from '../../context/Auth.context'
import { LocationContext } from '../../context/Location.context'

vi.mock('../../api/axios', () => ({
  __esModule: true,
  default: { get: vi.fn(), post: vi.fn() },
}))

const mockMap = {
  locate: vi.fn().mockReturnValue({
    on: vi.fn(
      (
        event: string,
        cb: (e: { latlng: [number, number]; accuracy: number }) => void
      ) => {
        if (event === 'locationfound') {
          setTimeout(() => cb({ latlng: [40.5, 21.6], accuracy: 100 }), 0)
        }
      }
    ),
  }),
  flyTo: vi.fn(),
  getZoom: vi.fn(() => 15),
  addLayer: vi.fn(),
}

vi.mock('react-leaflet', () => ({
  useMap: () => mockMap,
  Popup: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="popup">{children}</div>
  ),
}))

vi.mock('../LocationMarker/LocationMarker', () => ({
  default: function MockLocationMarker({ name }: { name?: string }) {
    return <div data-testid="location-marker">{name}</div>
  },
}))

const mockSaveLocation = vi.fn()
const mockFetchUsersNearby = vi.fn()

vi.mock('../../context/Users.context', () => ({
  useUsers: () => ({
    fetchUsersNearby: mockFetchUsersNearby,
    nearbyUsers: [],
    fetchUsers: vi.fn(),
    users: [],
    usersPagination: null,
    usersLoading: false,
    usersError: null,
    nearbyLoading: false,
    nearbyError: null,
    toggleUserActive: vi.fn(),
    clearUsers: vi.fn(),
    clearNearbyUsers: vi.fn(),
  }),
}))

const defaultAuth = {
  user: {
    userId: '1',
    username: 'Test',
    coordinates: [40.5, 21.6] as [number, number],
    type: 'myLocation' as const,
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

const defaultLocation = {
  location: null,
  loading: false,
  error: null,
  getLocation: vi.fn(),
  getSavedLocation: vi.fn(),
  saveLocation: mockSaveLocation,
  updateLocation: vi.fn(),
}

const renderMyLocation = () => {
  return render(
    <AuthContext.Provider
      value={{
        ...defaultAuth,
        user: {
          ...defaultAuth.user,
          coordinates: [40.5, 21.6] as [number, number],
        },
      }}
    >
      <LocationContext.Provider value={defaultLocation}>
        <MyLocation />
      </LocationContext.Provider>
    </AuthContext.Provider>
  )
}

describe('MyLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMap.locate.mockReturnValue({
      on: vi.fn(
        (
          event: string,
          cb: (e: { latlng: [number, number]; accuracy: number }) => void
        ) => {
          if (event === 'locationfound') {
            setTimeout(() => cb({ latlng: [40.5, 21.6], accuracy: 100 }), 0)
          }
        }
      ),
    })
  })

  test('calls map.locate on mount when user is present', () => {
    renderMyLocation()
    expect(mockMap.locate).toHaveBeenCalled()
  })

  test('renders location marker after location found', async () => {
    renderMyLocation()
    await new Promise((r) => setTimeout(r, 100))
    expect(screen.getByTestId('location-marker')).toBeInTheDocument()
  })
})
