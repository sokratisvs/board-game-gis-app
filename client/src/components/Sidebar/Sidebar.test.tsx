import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Sidebar from './Sidebar'

const renderSidebar = (open = true) => {
  const onToggle = jest.fn()
  const result = render(
    <MemoryRouter>
      <Sidebar open={open} onToggle={onToggle} />
    </MemoryRouter>
  )
  return { ...result, onToggle }
}

describe('Sidebar', () => {
  test('renders navigation with Map View, Users, Settings links', () => {
    renderSidebar()
    expect(screen.getByRole('navigation', { name: /primary/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /map view/i })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /users/i })).toHaveAttribute('href', '/users')
    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('href', '/settings')
  })

  test('shows Board Game GIS title when open', () => {
    renderSidebar(true)
    expect(screen.getByText(/Board Game GIS/i)).toBeInTheDocument()
  })

  test('shows toggle button with expand/collapse label', () => {
    const { onToggle } = renderSidebar(true)
    const toggle = screen.getByRole('button', { name: /collapse sidebar/i })
    expect(toggle).toBeInTheDocument()
    userEvent.click(toggle)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  test('when closed, toggle button has expand label', () => {
    renderSidebar(false)
    expect(screen.getByRole('button', { name: /expand sidebar/i })).toBeInTheDocument()
  })
})
