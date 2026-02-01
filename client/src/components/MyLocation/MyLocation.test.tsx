import React from 'react'
import { render, screen } from '@testing-library/react'
import MyLocation from './MyLocation'
import { AuthContext } from '../../context/Auth.context'
import { LocationContext } from '../../context/Location.context'

jest.mock('../../api/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}))

const mockMap = {
  locate: jest.fn().mockReturnValue({
    on: jest.fn(
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
  flyTo: jest.fn(),
  getZoom: jest.fn(() => 15),
  addLayer: jest.fn(),
}

jest.mock('react-leaflet', () => ({
  useMap: () => mockMap,
  Popup: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="popup">{children}</div>
  ),
}))

jest.mock('../LocationMarker/LocationMarker', () => {
  return function MockLocationMarker({ name }: { name?: string }) {
    return <div data-testid="location-marker">{name}</div>
  }
})

const mockSaveLocation = jest.fn()
const mockFetchUsersNearby = jest.fn()

jest.mock('../../context/Users.context', () => ({
  useUsers: () => ({
    fetchUsersNearby: mockFetchUsersNearby,
    nearbyUsers: [],
    fetchUsers: jest.fn(),
    users: [],
    usersPagination: null,
    usersLoading: false,
    usersError: null,
    nearbyLoading: false,
    nearbyError: null,
    toggleUserActive: jest.fn(),
    clearUsers: jest.fn(),
    clearNearbyUsers: jest.fn(),
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
  setUser: jest.fn(),
  setIsLoggedIn: jest.fn(),
  setLoginPending: jest.fn(),
  setLoginError: jest.fn(),
  register: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  setUserLocation: jest.fn(),
}

const defaultLocation = {
  location: null,
  loading: false,
  error: null,
  getLocation: jest.fn(),
  getSavedLocation: jest.fn(),
  saveLocation: mockSaveLocation,
  updateLocation: jest.fn(),
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
    jest.clearAllMocks()
    mockMap.locate.mockReturnValue({
      on: jest.fn(
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
