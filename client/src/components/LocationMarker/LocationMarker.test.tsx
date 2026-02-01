import React from 'react'
import { render, screen } from '@testing-library/react'
import LocationMarker from './LocationMarker'

vi.mock('react-leaflet', () => ({
  Marker: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="marker">{children}</div>
  ),
  Circle: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="circle">{children}</div>
  ),
  Popup: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="popup">{children}</div>
  ),
}))

vi.mock('leaflet', () => ({
  Icon: vi.fn().mockImplementation(() => ({})),
}))

vi.mock('../../assets/icons/red-marker-icon.png', () => ({
  default: '/mock-red-marker.png',
}))
vi.mock('../../assets/icons/marker-icon.png', () => ({
  default: '/mock-marker.png',
}))
vi.mock('../../assets/icons/question-mark-icon.png', () => ({
  default: '/mock-question.png',
}))

describe('LocationMarker', () => {
  test('renders nothing when type or position missing', () => {
    const { container } = render(
      <LocationMarker position={[0, 0]} type="" name="Test" />
    )
    expect(container.firstChild).toBeEmptyDOMElement()
  })

  test('renders marker with popup for myLocation type', () => {
    render(
      <LocationMarker
        position={[40.5, 21.6]}
        type="myLocation"
        name="My location"
      />
    )
    expect(screen.getByTestId('marker')).toBeInTheDocument()
    expect(screen.getByTestId('popup')).toBeInTheDocument()
    expect(screen.getByText('My location')).toBeInTheDocument()
  })

  test('renders circle for user type', () => {
    render(
      <LocationMarker position={[40.5, 21.6]} type="user" name="Test User" />
    )
    expect(screen.getByTestId('circle')).toBeInTheDocument()
    expect(screen.getByText('Test User')).toBeInTheDocument()
  })

  test('renders marker for shop type', () => {
    render(
      <LocationMarker position={[40.5, 21.6]} type="shop" name="Test Shop" />
    )
    expect(screen.getByTestId('marker')).toBeInTheDocument()
    expect(screen.getByText('Test Shop')).toBeInTheDocument()
  })

  test('renders marker for default/unknown type', () => {
    render(
      <LocationMarker position={[40.5, 21.6]} type="event" name="Test Event" />
    )
    expect(screen.getByTestId('marker')).toBeInTheDocument()
    expect(screen.getByText('Test Event')).toBeInTheDocument()
  })
})
