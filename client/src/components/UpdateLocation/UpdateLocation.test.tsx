import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UpdateLocation from './UpdateLocation'
import { AuthContext } from '../../context/Auth.context'
import { LocationContext } from '../../context/Location.context'

jest.mock('../../api/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}))

const mockGetLocation = jest.fn()
const mockGetSavedLocation = jest.fn()
const mockSaveLocation = jest.fn()
const mockUpdateLocation = jest.fn()
const mockSetUserLocation = jest.fn()

const defaultAuthContext = {
  user: {
    userId: '1',
    username: 'Test',
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
  logout: jest.fn(),
  setUserLocation: mockSetUserLocation,
}

const defaultLocationContext = {
  location: { lat: 40.5, lng: 21.6 },
  loading: false,
  error: null,
  getLocation: mockGetLocation,
  getSavedLocation: mockGetSavedLocation,
  saveLocation: mockSaveLocation,
  updateLocation: mockUpdateLocation,
}

const renderUpdateLocation = (authOverrides = {}, locationOverrides = {}) => {
  return render(
    <AuthContext.Provider value={{ ...defaultAuthContext, ...authOverrides }}>
      <LocationContext.Provider
        value={{ ...defaultLocationContext, ...locationOverrides }}
      >
        <UpdateLocation />
      </LocationContext.Provider>
    </AuthContext.Provider>
  )
}

describe('UpdateLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetSavedLocation.mockResolvedValue({ data: [] })
  })

  test('renders Update Location button', () => {
    renderUpdateLocation()
    expect(
      screen.getByRole('button', { name: /update location/i })
    ).toBeInTheDocument()
  })

  test('calls getLocation on mount when user is present', () => {
    renderUpdateLocation()
    expect(mockGetLocation).toHaveBeenCalled()
  })

  test('on click calls setUserLocation and save or update location', async () => {
    mockGetSavedLocation.mockResolvedValue({ data: [] })
    mockSaveLocation.mockResolvedValue(undefined)
    renderUpdateLocation()
    await userEvent.click(
      screen.getByRole('button', { name: /update location/i })
    )
    await waitFor(() => {
      expect(mockSetUserLocation).toHaveBeenCalledWith({ lat: 40.5, lng: 21.6 })
      expect(mockGetSavedLocation).toHaveBeenCalledWith('1')
      expect(mockSaveLocation).toHaveBeenCalledWith('1', {
        lat: 40.5,
        lng: 21.6,
      })
    })
  })

  test('on click calls updateLocation when saved location exists', async () => {
    mockGetSavedLocation.mockResolvedValue({
      data: [{ coordinates: { lat: 40.5, lng: 21.6 } }],
    })
    mockUpdateLocation.mockResolvedValue(undefined)
    renderUpdateLocation()
    await userEvent.click(
      screen.getByRole('button', { name: /update location/i })
    )
    await waitFor(() => {
      expect(mockUpdateLocation).toHaveBeenCalledWith('1', {
        lat: 40.5,
        lng: 21.6,
      })
    })
  })
})
