import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Users from './Users'

const mockFetchUsers = vi.fn()
const mockToggleUserActive = vi.fn()

const defaultUseUsersReturn = {
  users: [
    {
      user_id: 1,
      username: 'Alice',
      email: 'alice@example.com',
      type: 'user',
      active: true,
    },
    {
      user_id: 2,
      username: 'Bob',
      email: 'bob@example.com',
      type: 'shop',
      active: false,
    },
  ],
  nearbyUsers: [],
  usersPagination: {
    currentPage: 1,
    totalPages: 2,
    hasNextPage: true,
    hasPreviousPage: false,
  },
  usersLoading: false,
  usersError: null,
  fetchUsers: mockFetchUsers,
  fetchUsersNearby: vi.fn(),
  toggleUserActive: mockToggleUserActive,
  clearUsers: vi.fn(),
  clearNearbyUsers: vi.fn(),
}

const mockUseUsers = vi.fn(() => defaultUseUsersReturn)
vi.mock('../../context/Users.context', () => ({
  useUsers: () => mockUseUsers(),
}))

const renderUsers = (overrides = {}) => {
  mockUseUsers.mockReturnValue({ ...defaultUseUsersReturn, ...overrides })
  return render(<Users />)
}

describe('Users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders Users heading', () => {
    renderUsers()
    expect(screen.getByRole('heading', { name: /users/i })).toBeInTheDocument()
  })

  test('calls fetchUsers on mount', () => {
    renderUsers()
    expect(mockFetchUsers).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      active: undefined,
    })
  })

  test('renders filter buttons All Users, Active Only, Inactive Only', () => {
    renderUsers()
    const allUsersBtn = screen.getAllByRole('button', { name: /all users/i })[0]
    const activeOnlyBtn = screen.getAllByRole('button', {
      name: /^active only$/i,
    })[0]
    const inactiveOnlyBtn = screen.getAllByRole('button', {
      name: /^inactive only$/i,
    })[0]
    expect(allUsersBtn).toBeInTheDocument()
    expect(activeOnlyBtn).toBeInTheDocument()
    expect(inactiveOnlyBtn).toBeInTheDocument()
  })

  test('renders user table with usernames and emails', () => {
    renderUsers()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('bob@example.com')).toBeInTheDocument()
  })

  test('renders Active/Inactive status badges', () => {
    renderUsers()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  test('calls toggleUserActive when Activate/Deactivate clicked', async () => {
    mockToggleUserActive.mockResolvedValue(undefined)
    renderUsers()
    const deactivateBtn = screen.getByRole('button', { name: /deactivate/i })
    await userEvent.click(deactivateBtn)
    expect(mockToggleUserActive).toHaveBeenCalledWith(1)
  })

  test('calls fetchUsers with active filter when Active Only clicked', async () => {
    renderUsers()
    const activeOnlyBtn = screen.getAllByRole('button', {
      name: /^active only$/i,
    })[0]
    await userEvent.click(activeOnlyBtn)
    expect(mockFetchUsers).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      active: true,
    })
  })

  test('shows loading state when usersLoading is true', () => {
    renderUsers({ usersLoading: true })
    expect(screen.getByText(/loading users/i)).toBeInTheDocument()
  })

  test('shows error when usersError is set', () => {
    renderUsers({ usersError: 'Failed to load users' })
    expect(screen.getByRole('alert')).toHaveTextContent(/failed to load users/i)
  })

  test('shows No users found when users array is empty', () => {
    renderUsers({ users: [] })
    expect(screen.getByText(/no users found/i)).toBeInTheDocument()
  })

  test('renders pagination when totalPages > 1', () => {
    renderUsers()
    expect(
      screen.getByRole('button', { name: /previous/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
    expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument()
  })
})
