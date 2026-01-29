import React from 'react'
import { render, screen } from '@testing-library/react'
import { AuthContextProvider } from './context/Auth.context'
import { LocationProvider } from './context/Location.context'
import { UsersContextProvider } from './context/Users.context'
import App from './App'
import { getBasePath } from './config/basePath'

jest.mock('./api/axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    create: jest.fn(() => ({ get: jest.fn(), post: jest.fn() })),
  },
}))

jest.mock('./config/basePath', () => ({
  getBasePath: jest.fn(() => ''),
}))

const renderAppWithProviders = () =>
  render(
    <AuthContextProvider>
      <LocationProvider>
        <UsersContextProvider>
          <App />
        </UsersContextProvider>
      </LocationProvider>
    </AuthContextProvider>
  )

describe('App', () => {
  test('renders app title', () => {
    renderAppWithProviders()
    const titleElement = screen.getByText(/Board Game App/i)
    expect(titleElement).toBeInTheDocument()
  })

  describe('BASE_PATH / basename', () => {
    test('when base path is set, login page Register link includes base path in href', () => {
      ;(getBasePath as jest.Mock).mockReturnValue('/boardgamesapp')
      window.history.replaceState({}, '', '/boardgamesapp/login')
      renderAppWithProviders()
      const registerLink = screen.getByRole('link', { name: /register/i })
      expect(registerLink).toHaveAttribute('href', '/boardgamesapp/register')
    })

    test('when base path is empty, login page Register link has href "/register"', () => {
      ;(getBasePath as jest.Mock).mockReturnValue('')
      window.history.replaceState({}, '', '/login')
      renderAppWithProviders()
      const registerLink = screen.getByRole('link', { name: /register/i })
      expect(registerLink).toHaveAttribute('href', '/register')
    })
  })
})
