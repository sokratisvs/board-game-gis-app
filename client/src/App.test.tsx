import React from 'react'
import { render, screen } from '@testing-library/react'
import { AuthContextProvider } from './context/Auth.context'
import { LocationProvider } from './context/Location.context'
import { UsersContextProvider } from './context/Users.context'
import App from './App'

jest.mock('./api/axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    create: jest.fn(() => ({ get: jest.fn(), post: jest.fn() })),
  },
}))

// Avoid Suspense act() warning: render routes synchronously instead of React.lazy
jest.mock('./routes', () => {
  const React = require('react')
  return {
    __esModule: true,
    default: [
      {
        path: '/',
        element: React.createElement('div', null, 'Board Game App'),
      },
      { path: 'users', element: React.createElement('div', null, 'Users') },
    ],
  }
})

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
  test('renders app title', async () => {
    renderAppWithProviders()
    const titleElement = await screen.findByText(/Board Game App/i)
    expect(titleElement).toBeInTheDocument()
  })

  test('login page has Register link with href /register', async () => {
    renderAppWithProviders()
    const registerLink = await screen.findByRole('link', { name: /register/i })
    expect(registerLink).toHaveAttribute('href', '/register')
  })
})
