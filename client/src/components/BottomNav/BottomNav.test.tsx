import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BottomNav from './BottomNav'

const renderBottomNav = (initialPath = '/') => {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <BottomNav />
    </MemoryRouter>
  )
}

describe('BottomNav', () => {
  test('renders bottom navigation with Map, Users, Settings links', () => {
    renderBottomNav()
    expect(screen.getByRole('navigation', { name: /bottom navigation/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /map/i })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /users/i })).toHaveAttribute('href', '/users')
    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('href', '/settings')
  })

  test('renders all nav links when on users path', () => {
    renderBottomNav('/users')
    expect(screen.getByRole('link', { name: /map/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /users/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument()
  })

  test('marks root link as current when on home', () => {
    renderBottomNav('/')
    const mapLink = screen.getByRole('link', { name: /map/i })
    expect(mapLink).toHaveAttribute('aria-current', 'page')
  })
})
