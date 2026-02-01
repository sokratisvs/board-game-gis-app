import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Map from './Map'

vi.mock('../../api/axios', () => ({
  __esModule: true,
  default: { get: vi.fn(), post: vi.fn() },
}))

vi.mock('../MapComponent/MapComponent', () => ({
  default: function MockMapComponent() {
    return <div data-testid="map-component">Map</div>
  },
}))

describe('Map', () => {
  test('renders map section', () => {
    render(
      <MemoryRouter>
        <Map />
      </MemoryRouter>
    )
    expect(screen.getByTestId('map-component')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /map/i })).toBeInTheDocument()
  })
})
