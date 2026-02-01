import React from 'react'
import { render, screen } from '@testing-library/react'
import MapComponent from './MapComponent'

vi.mock('../../api/axios', () => ({
  __esModule: true,
  default: { get: vi.fn(), post: vi.fn() },
}))

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
}))

vi.mock('../LocationMarker/LocationMarker', () => ({
  default: function MockLocationMarker({ name }: { name?: string }) {
    return <div data-testid="location-marker">{name || 'Marker'}</div>
  },
}))

vi.mock('../MyLocation/MyLocation', () => ({
  default: function MockMyLocation() {
    return <div data-testid="my-location">My Location</div>
  },
}))

vi.mock('../../context/Users.context', () => ({
  useUsers: () => ({
    nearbyUsers: [
      {
        user_id: 1,
        username: 'Alice',
        latitude: 40.5,
        longitude: 21.6,
        type: 'user',
      },
    ],
    fetchUsersNearby: vi.fn(),
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

describe('MapComponent', () => {
  test('renders map container', () => {
    render(<MapComponent />)
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })

  test('renders tile layer', () => {
    render(<MapComponent />)
    expect(screen.getByTestId('tile-layer')).toBeInTheDocument()
  })

  test('renders MyLocation component', () => {
    render(<MapComponent />)
    expect(screen.getByTestId('my-location')).toBeInTheDocument()
    expect(screen.getByText('My Location')).toBeInTheDocument()
  })

  test('renders location markers for nearby users', () => {
    render(<MapComponent />)
    expect(
      screen.getAllByTestId('location-marker').length
    ).toBeGreaterThanOrEqual(1)
  })
})
