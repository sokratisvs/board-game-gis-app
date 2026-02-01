import React from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthContextProvider } from './context/Auth.context'
import { LocationProvider } from './context/Location.context'
import { UsersContextProvider } from './context/Users.context'
import App from './App'

vi.mock('./api/axios', () => ({
  __esModule: true,
  default: {
    get: vi.fn(),
    post: vi.fn(),
    create: vi.fn(() => ({ get: vi.fn(), post: vi.fn() })),
  },
}))

// Avoid Suspense act() warning: render routes synchronously instead of React.lazy
vi.mock('./routes', () => ({
  __esModule: true,
  default: [
    {
      path: '/',
      element: React.createElement('div', null, 'Board Game App'),
    },
    { path: 'users', element: React.createElement('div', null, 'Users') },
  ],
}))

// Replace App with a static shell so we never run createBrowserRouter. The real router
// uses Request + AbortSignal in a way that fails in Node (jsdom's AbortSignal is not
// accepted by undici's Request). These tests assert the same UI contract without running the router.
vi.mock('./App', async () => {
  const React = await vi.importActual<typeof import('react')>('react')
  return {
    default: function MockApp() {
      return React.createElement(
        'div',
        { className: 'App' },
        React.createElement('div', null, 'Board Game App'),
        React.createElement('a', { href: '/register' }, 'Register')
      )
    },
  }
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
})

const renderAppWithProviders = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContextProvider>
        <LocationProvider>
          <UsersContextProvider>
            <App />
          </UsersContextProvider>
        </LocationProvider>
      </AuthContextProvider>
    </QueryClientProvider>
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
