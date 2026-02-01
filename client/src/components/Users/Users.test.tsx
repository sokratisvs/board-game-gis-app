import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Users from './Users'
import { AuthContext } from '../../context/Auth.context'
import * as useUsersQueries from '../../hooks/useUsersQueries'

const mockMutate = vi.fn()
const mockToggleActive = vi.fn()

const defaultUsersData = {
  users: [
    {
      user_id: 1,
      username: 'Alice',
      email: 'alice@example.com',
      type: 'user',
      active: true,
      created_on: '',
      last_login: '',
    },
    {
      user_id: 2,
      username: 'Bob',
      email: 'bob@example.com',
      type: 'shop',
      active: false,
      created_on: '',
      last_login: '',
    },
  ],
  pagination: {
    currentPage: 1,
    totalPages: 2,
    totalRecords: 2,
    limit: 20,
    hasNextPage: true,
    hasPreviousPage: false,
  },
}

vi.mock('../../hooks/useUsersQueries', () => ({
  useUsersList: vi.fn(() => ({
    data: defaultUsersData,
    isLoading: false,
    error: null,
    isFetching: false,
  })),
  useUserConfig: vi.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
  })),
  useToggleUserActive: vi.fn(() => ({
    mutate: mockToggleActive,
    isPending: false,
  })),
  useSaveUserConfig: vi.fn(() => ({
    mutate: mockMutate,
    isPending: false,
    error: null,
  })),
}))

const adminContext = {
  user: { userId: '1', username: 'admin', type: 'myLocation', role: 'admin' },
  isLoggedIn: true,
  loginPending: false,
  loginError: undefined,
  setUser: vi.fn(),
  setIsLoggedIn: vi.fn(),
  setLoginPending: vi.fn(),
  setLoginError: vi.fn(),
  register: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  setUserLocation: vi.fn(),
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
})

const renderUsers = (overrides?: Partial<typeof adminContext>) => {
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={{ ...adminContext, ...overrides }}>
          <Users />
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('Users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders Users heading', () => {
    renderUsers()
    expect(
      screen.getByRole('heading', { name: /^users$/i })
    ).toBeInTheDocument()
  })

  test('renders type filter buttons User, Shop, Event', () => {
    renderUsers()
    expect(screen.getByRole('button', { name: /^user$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^shop$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^event$/i })).toBeInTheDocument()
  })

  test('renders user table with usernames and emails', () => {
    renderUsers()
    expect(screen.getByRole('grid')).toHaveTextContent('Alice')
    expect(screen.getByRole('grid')).toHaveTextContent('alice@example.com')
    expect(screen.getByRole('grid')).toHaveTextContent('Bob')
    expect(screen.getByRole('grid')).toHaveTextContent('bob@example.com')
  })

  test('renders Active/Inactive status badges', () => {
    renderUsers()
    const activeLabels = screen.getAllByText('Active')
    const inactiveLabels = screen.getAllByText('Inactive')
    expect(activeLabels.length).toBeGreaterThanOrEqual(1)
    expect(inactiveLabels.length).toBeGreaterThanOrEqual(1)
  })

  test('calls toggleUserActive when Disable clicked', async () => {
    renderUsers()
    const disableBtns = screen.getAllByRole('button', {
      name: /deactivate user/i,
    })
    await userEvent.click(disableBtns[0])
    expect(mockToggleActive).toHaveBeenCalledWith({
      userId: 1,
      currentActive: true,
    })
  })

  test('renders pagination when totalPages > 1', () => {
    renderUsers()
    expect(
      screen.getByRole('button', { name: /previous/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
    expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument()
  })

  test('shows loading state when usersLoading is true', () => {
    vi.mocked(useUsersQueries.useUsersList).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      isFetching: true,
    } as ReturnType<typeof useUsersQueries.useUsersList>)
    renderUsers()
    expect(screen.getByText(/loading users/i)).toBeInTheDocument()
  })

  test('shows error when usersError is set', () => {
    vi.mocked(useUsersQueries.useUsersList).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to load users'),
      isFetching: false,
    } as ReturnType<typeof useUsersQueries.useUsersList>)
    renderUsers()
    expect(screen.getByRole('alert')).toHaveTextContent(/failed to load users/i)
  })
})
