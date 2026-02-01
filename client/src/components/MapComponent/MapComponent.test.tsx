import React from 'react'
import { render, screen } from '@testing-library/react'
import MapComponent from './MapComponent'

jest.mock('../../api/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}))

jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
}))

jest.mock('../LocationMarker/LocationMarker', () => {
  return function MockLocationMarker({ name }: { name?: string }) {
    return <div data-testid="location-marker">{name || 'Marker'}</div>
  }
})

jest.mock('../MyLocation/MyLocation', () => {
  return function MockMyLocation() {
    return <div data-testid="my-location">My Location</div>
  }
})

jest.mock('../../context/Users.context', () => ({
  useUsers: () => ({
    nearbyUsers: [
      { user_id: 1, username: 'Alice', latitude: 40.5, longitude: 21.6, type: 'user' },
    ],
    fetchUsersNearby: jest.fn(),
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
    expect(screen.getAllByTestId('location-marker').length).toBeGreaterThanOrEqual(1)
  })
})
