import { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../../context/Auth.context'
import PathConstants from '../../routes/pathConstants'
import {
  useUsersList,
  useUserConfig,
  useToggleUserActive,
  useSaveUserConfig,
  type UserConfig,
  type User,
} from '../../hooks/useUsersQueries'
import PageLayout from '../PageLayout/PageLayout'
import Section from '../ui/Section'
import Alert from '../ui/Alert'
import LoadingMessage from '../ui/LoadingMessage'
import Modal from '../ui/Modal'

const DEFAULT_CONFIG: Omit<UserConfig, 'user_id' | 'updated_at'> = {
  games_owned: [],
  games_liked: [],
  game_types_interested: [],
  has_space: false,
  city: null,
  subscription: 'free',
}

function arrayToComma(list: string[]): string {
  return Array.isArray(list) ? list.join(', ') : ''
}

function commaToArray(s: string): string[] {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

const USER_TYPES = [
  { value: 'user', label: 'User' },
  { value: 'shop', label: 'Shop' },
  { value: 'event', label: 'Event' },
] as const

const STATUS_FILTERS = [
  { value: 'all', label: 'All status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
] as const

const SEARCH_DEBOUNCE_MS = 300

const tableThClass =
  'p-3 sm:p-2 text-left border-b border-slate-200 font-semibold ' +
  'text-slate-600 bg-slate-50'
const tableTdClass = 'p-3 sm:p-2 text-left border-b border-slate-200'
const tableActionsClass = tableTdClass + ' min-w-[11rem] whitespace-nowrap'
const btnMinWidth = 'min-w-[5rem]' // 80px so buttons don't get squeezed
const btnToggleClass =
  'px-3 py-1.5 rounded text-[0.8125rem] font-medium border-none ' +
  'cursor-pointer transition bg-slate-200 text-slate-700 hover:bg-slate-300 ' +
  'disabled:opacity-60 disabled:cursor-not-allowed ' +
  btnMinWidth
const btnConfigClass =
  'px-3 py-1.5 rounded text-[0.8125rem] font-medium border-none ' +
  'cursor-pointer transition bg-primary text-white hover:bg-primary-hover ' +
  btnMinWidth
const btnPaginationClass =
  'px-4 py-2 rounded border border-slate-300 bg-white cursor-pointer ' +
  'text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed'
const inputClass =
  'px-3 py-2 border border-slate-300 rounded text-sm ' +
  'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
const btnSecondaryClass =
  'px-3 py-1.5 rounded text-sm font-medium border-none cursor-pointer ' +
  'transition bg-slate-200 text-slate-600 hover:bg-slate-300'
const btnPrimaryClass =
  'px-3 py-1.5 rounded text-sm font-medium border-none cursor-pointer ' +
  'transition bg-primary text-white hover:bg-primary-hover ' +
  'disabled:opacity-60 disabled:cursor-not-allowed'
const filterBtnUnselected =
  'px-3 py-1.5 rounded text-sm font-medium border-2 border-slate-300 ' +
  'bg-slate-200 text-slate-700 hover:bg-slate-300 focus:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ' +
  btnMinWidth
const filterBtnSelected =
  'bg-primary text-white border-2 border-primary hover:bg-primary-hover ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ' +
  'focus-visible:ring-offset-2 ring-2 ring-primary ring-offset-2 ' +
  btnMinWidth

const PAGE_SIZE = 20

export default function Users() {
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'inactive'
  >('all')
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [configUser, setConfigUser] = useState<{
    id: number
    username: string
  } | null>(null)
  const [configForm, setConfigForm] = useState<UserConfig | null>(null)

  const isAdmin = user?.role === 'admin'

  // Pass selected types when any; empty = show all
  const typesFilter = selectedTypes.length > 0 ? selectedTypes : undefined
  const activeFilter =
    statusFilter === 'all' ? undefined : statusFilter === 'active'
  const {
    data: usersData,
    isLoading: usersLoading,
    error: usersError,
  } = useUsersList({
    page,
    limit: PAGE_SIZE,
    types: typesFilter,
    username: debouncedSearch.trim() || undefined,
    active: activeFilter,
    enabled: Boolean(isAdmin),
  })

  const users = usersData?.users ?? []
  const usersPagination = usersData?.pagination ?? null

  const {
    data: configData,
    isLoading: configLoading,
    error: configQueryError,
  } = useUserConfig(configUser?.id ?? null)

  const config = configForm ?? configData ?? null

  const toggleActive = useToggleUserActive()
  const saveConfigMutation = useSaveUserConfig()

  useEffect(() => {
    if (!isAdmin) {
      navigate(PathConstants.MAP, { replace: true })
      return
    }
  }, [isAdmin, navigate])

  // Debounce search input so we don't hit the API on every keystroke
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch((prev) => {
        if (prev !== searchQuery) setPage(1)
        return searchQuery
      })
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [searchQuery])

  useEffect(() => {
    if (configUser && configData) setConfigForm(configData)
    if (configUser && !configData && !configLoading)
      setConfigForm({ user_id: configUser.id, ...DEFAULT_CONFIG } as UserConfig)
    if (!configUser) setConfigForm(null)
  }, [configUser, configData, configLoading])

  const configError =
    (configQueryError ? (configQueryError as Error).message : null) ||
    (saveConfigMutation.error
      ? (saveConfigMutation.error as Error).message
      : null) ||
    null

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage)
  }

  const toggleTypeFilter = (value: string) => {
    setSelectedTypes((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    )
    setPage(1)
  }

  const setStatusFilterAndResetPage = (
    value: 'all' | 'active' | 'inactive'
  ) => {
    setStatusFilter(value)
    setPage(1)
  }

  const handleOpenConfig = (userId: number, username: string) => {
    setConfigUser({ id: userId, username })
  }

  const handleCloseConfig = () => {
    setConfigUser(null)
    setConfigForm(null)
  }

  const handleConfigChange = (field: keyof UserConfig, value: unknown) => {
    if (!configForm) return
    setConfigForm({ ...configForm, [field]: value })
  }

  const handleSaveConfig = () => {
    if (!configUser || !configForm) return
    saveConfigMutation.mutate(
      {
        userId: configUser.id,
        config: {
          games_owned: configForm.games_owned,
          games_liked: configForm.games_liked,
          game_types_interested: configForm.game_types_interested,
          has_space: configForm.has_space,
          city: configForm.city ?? null,
          subscription: configForm.subscription,
        },
      },
      { onSuccess: handleCloseConfig }
    )
  }

  const handleToggleActive = (u: { user_id: number; active: boolean }) => {
    toggleActive.mutate({
      userId: u.user_id,
      currentActive: u.active,
    })
  }

  if (!isAdmin) return null

  return (
    <PageLayout
      title="Users"
      description="Manage users and board games configuration."
    >
      <Section id="users-heading" title="User list">
        {/* Search by username */}
        <div className="mb-4">
          <label
            htmlFor="users-search"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Search by username
          </label>
          <div className="relative inline-block w-full max-w-sm">
            <input
              id="users-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type to filter by name…"
              className={
                inputClass +
                ' w-full pr-12 [&::-webkit-search-cancel-button]:appearance-none'
              }
              aria-describedby="users-search-hint"
              aria-label="Search by username"
            />
            {searchQuery.length > 0 && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className={
                  'absolute right-1 top-1/2 -translate-y-1/2 flex items-center ' +
                  'justify-center min-w-[2.75rem] min-h-[2.75rem] rounded ' +
                  'text-slate-500 hover:text-slate-700 hover:bg-slate-200 ' +
                  'focus:outline-none focus:ring-2 focus:ring-primary ' +
                  'focus:ring-inset transition-colors'
                }
                aria-label="Clear search"
              >
                <span className="text-xl leading-none" aria-hidden="true">
                  ×
                </span>
              </button>
            )}
          </div>
          <p id="users-search-hint" className="text-xs text-slate-500 mt-1 m-0">
            Results update as you type (search is case-insensitive).
          </p>
        </div>

        {/* Status filter: one line on mobile, All / Active / Inactive */}
        <div
          className="flex flex-nowrap gap-2 mb-3 md:flex-wrap md:mb-4 overflow-x-auto md:overflow-visible pb-1 md:pb-0"
          role="group"
          aria-label="Filter by status"
        >
          {STATUS_FILTERS.map(({ value, label }) => {
            const isSelected = statusFilter === value
            return (
              <button
                key={value}
                type="button"
                className={isSelected ? filterBtnSelected : filterBtnUnselected}
                onClick={() =>
                  setStatusFilterAndResetPage(
                    value as 'all' | 'active' | 'inactive'
                  )
                }
                aria-pressed={isSelected}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Type filter: one line on mobile, User / Shop / Event */}
        <div
          className="flex flex-nowrap gap-2 mb-4 overflow-x-auto md:overflow-visible pb-1 md:pb-0 md:flex-wrap"
          role="group"
          aria-label="Filter by user type"
        >
          {USER_TYPES.map(({ value, label }) => {
            const isSelected = selectedTypes.includes(value)
            return (
              <button
                key={value}
                type="button"
                className={isSelected ? filterBtnSelected : filterBtnUnselected}
                onClick={() => toggleTypeFilter(value)}
                aria-pressed={isSelected}
              >
                {label}
              </button>
            )
          })}
        </div>

        {usersError && <Alert>{(usersError as Error).message}</Alert>}
        {usersLoading ? (
          <LoadingMessage>Loading users…</LoadingMessage>
        ) : (
          <>
            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto">
              <table
                className="w-full min-w-[600px] border-collapse text-sm"
                role="grid"
              >
                <thead>
                  <tr>
                    <th className={tableThClass}>ID</th>
                    <th className={tableThClass}>Name</th>
                    <th className={tableThClass}>Email</th>
                    <th className={tableThClass}>Type</th>
                    <th className={tableThClass}>Status</th>
                    <th className={tableThClass + ' min-w-[11rem]'}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u: User) => (
                    <tr key={u.user_id} className="hover:bg-slate-50">
                      <td className={tableTdClass}>{u.user_id}</td>
                      <td className={tableTdClass}>{u.username}</td>
                      <td className={tableTdClass}>{u.email}</td>
                      <td className={tableTdClass}>{u.type}</td>
                      <td className={tableTdClass}>
                        <span
                          className={
                            'inline-block px-2 py-1 rounded-full text-xs ' +
                            'font-semibold ' +
                            (u.active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800')
                          }
                        >
                          {u.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className={tableActionsClass}>
                        <div className="flex items-center gap-2 flex-nowrap">
                          <button
                            type="button"
                            className={btnToggleClass}
                            onClick={() => handleToggleActive(u)}
                            disabled={toggleActive.isPending}
                            aria-label={
                              u.active ? 'Deactivate user' : 'Activate user'
                            }
                          >
                            {u.active ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            type="button"
                            className={btnConfigClass}
                            onClick={() =>
                              handleOpenConfig(u.user_id, u.username)
                            }
                            aria-label={`Edit config for ${u.username}`}
                          >
                            Config
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: card list (no horizontal scroll, full content) */}
            <ul className="md:hidden list-none p-0 m-0 space-y-3" role="list">
              {users.map((u: User) => (
                <li
                  key={u.user_id}
                  className="bg-slate-50 rounded-lg border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                    <h3 className="text-base font-semibold text-slate-800 m-0">
                      {u.username}
                    </h3>
                    <span
                      className={
                        'inline-block px-2 py-1 rounded-full text-xs font-semibold shrink-0 ' +
                        (u.active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800')
                      }
                    >
                      {u.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <dl className="grid grid-cols-1 gap-1.5 text-sm m-0 mb-4">
                    <div>
                      <dt className="inline font-medium text-slate-500 after:content-[':'] after:mr-1">
                        ID
                      </dt>
                      <dd className="inline text-slate-800">{u.user_id}</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium text-slate-500 after:content-[':'] after:mr-1">
                        Email
                      </dt>
                      <dd className="inline text-slate-800 break-all">
                        {u.email}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline font-medium text-slate-500 after:content-[':'] after:mr-1">
                        Type
                      </dt>
                      <dd className="inline text-slate-800">{u.type}</dd>
                    </div>
                  </dl>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={btnToggleClass}
                      onClick={() => handleToggleActive(u)}
                      disabled={toggleActive.isPending}
                      aria-label={
                        u.active ? 'Deactivate user' : 'Activate user'
                      }
                    >
                      {u.active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      type="button"
                      className={btnConfigClass}
                      onClick={() => handleOpenConfig(u.user_id, u.username)}
                      aria-label={`Edit config for ${u.username}`}
                    >
                      Config
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {usersPagination && usersPagination.totalPages > 1 && (
              <nav
                className={
                  'flex items-center justify-center gap-4 mt-4 pt-4 ' +
                  'border-t border-slate-200 text-sm text-slate-500'
                }
                aria-label="Users pagination"
              >
                <button
                  type="button"
                  className={btnPaginationClass}
                  onClick={() =>
                    handlePageChange(usersPagination.currentPage - 1)
                  }
                  disabled={!usersPagination.hasPreviousPage}
                >
                  Previous
                </button>
                <span>
                  Page {usersPagination.currentPage} of{' '}
                  {usersPagination.totalPages} ({usersPagination.totalRecords}{' '}
                  total)
                </span>
                <button
                  type="button"
                  className={btnPaginationClass}
                  onClick={() =>
                    handlePageChange(usersPagination.currentPage + 1)
                  }
                  disabled={!usersPagination.hasNextPage}
                >
                  Next
                </button>
              </nav>
            )}
          </>
        )}
      </Section>

      <Modal
        open={!!configUser}
        onClose={handleCloseConfig}
        title={configUser ? `Board games config — ${configUser.username}` : ''}
        titleId="config-modal-title"
      >
        {configError && (
          <div className="mx-4 mt-4">
            <Alert>{configError}</Alert>
          </div>
        )}
        {configLoading ? (
          <LoadingMessage>Loading config…</LoadingMessage>
        ) : config ? (
          <div className="p-5 flex flex-col gap-4">
            <label
              className={
                'flex flex-col gap-1 text-sm font-medium text-slate-700'
              }
            >
              Games owned (comma-separated)
              <input
                type="text"
                value={arrayToComma(config.games_owned)}
                onChange={(e) =>
                  handleConfigChange(
                    'games_owned',
                    commaToArray(e.target.value)
                  )
                }
                placeholder="Catan, Ticket to Ride"
                className={inputClass}
              />
            </label>
            <label
              className={
                'flex flex-col gap-1 text-sm font-medium text-slate-700'
              }
            >
              Games liked (comma-separated)
              <input
                type="text"
                value={arrayToComma(config.games_liked)}
                onChange={(e) =>
                  handleConfigChange(
                    'games_liked',
                    commaToArray(e.target.value)
                  )
                }
                placeholder="Carcassonne"
                className={inputClass}
              />
            </label>
            <label
              className={
                'flex flex-col gap-1 text-sm font-medium text-slate-700'
              }
            >
              Game types interested (comma-separated)
              <input
                type="text"
                value={arrayToComma(config.game_types_interested)}
                onChange={(e) =>
                  handleConfigChange(
                    'game_types_interested',
                    commaToArray(e.target.value)
                  )
                }
                placeholder="strategy, party, cooperative"
                className={inputClass}
              />
            </label>
            <label
              className={
                'flex flex-row items-center gap-2 text-sm ' +
                'font-medium text-slate-700'
              }
            >
              <input
                type="checkbox"
                checked={config.has_space}
                onChange={(e) =>
                  handleConfigChange('has_space', e.target.checked)
                }
                className="w-auto"
              />
              <span>Has space for hosting games</span>
            </label>
            <label
              className={
                'flex flex-col gap-1 text-sm font-medium text-slate-700'
              }
            >
              City
              <input
                type="text"
                value={config.city ?? ''}
                onChange={(e) =>
                  handleConfigChange('city', e.target.value || null)
                }
                placeholder="e.g. Athens"
                className={inputClass}
              />
            </label>
            <label
              className={
                'flex flex-col gap-1 text-sm font-medium text-slate-700'
              }
            >
              Subscription
              <select
                value={config.subscription}
                onChange={(e) =>
                  handleConfigChange(
                    'subscription',
                    e.target.value as 'free' | 'extra'
                  )
                }
                className={inputClass}
              >
                <option value="free">Free</option>
                <option value="extra">Extra</option>
              </select>
            </label>
            <div
              className={
                'flex justify-end gap-3 mt-2 pt-4 ' +
                'border-t border-slate-200'
              }
            >
              <button
                type="button"
                onClick={handleCloseConfig}
                className={btnSecondaryClass}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveConfig}
                disabled={saveConfigMutation.isPending}
                className={btnPrimaryClass}
              >
                {saveConfigMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </PageLayout>
  )
}
