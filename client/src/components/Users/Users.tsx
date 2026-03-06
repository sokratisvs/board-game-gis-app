import { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../../context/Auth.context'
import PathConstants from '../../routes/pathConstants'
import {
  useUsersList,
  useUserConfig,
  useToggleUserActive,
  useSaveUserConfig,
  useDeleteUser,
  type UserConfig,
  type User,
} from '../../hooks/useUsersQueries'
import PageLayout from '../PageLayout/PageLayout'
import Section from '../ui/Section'
import Alert from '../ui/Alert'
import LoadingMessage from '../ui/LoadingMessage'
import Modal from '../ui/Modal'

const DEFAULT_CONFIG: Omit<UserConfig, 'user_id' | 'updated_at'> = {
  interests: [],
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
  { value: 'all', label: 'All' },
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
const btnDangerClass =
  'px-3 py-1.5 rounded text-sm font-medium border-none cursor-pointer ' +
  'transition bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed'
const PAGE_SIZE = 20

const CONFIRM_WORDS = { delete: 'delete', disable: 'disable' } as const

const CloseDangerIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className="w-4 h-4 shrink-0"
    aria-hidden
  >
    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-2.72 2.72a.75.75 0 101.06 1.06L10 11.06l2.72 2.72a.75.75 0 101.06-1.06L11.06 10l2.72-2.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
  </svg>
)

export default function Users() {
  const navigate = useNavigate()
  const { user, authInitialized } = useContext(AuthContext)
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'inactive'
  >('all')
  const [typeFilter, setTypeFilter] = useState<
    'all' | 'user' | 'shop' | 'event'
  >('all')
  const [configUser, setConfigUser] = useState<{
    id: number
    username: string
  } | null>(null)
  const [configForm, setConfigForm] = useState<UserConfig | null>(null)
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set())
  const [confirmModal, setConfirmModal] = useState<{
    action: 'delete' | 'disable'
    userIds: number[]
    label?: string
  } | null>(null)
  const [confirmInput, setConfirmInput] = useState('')

  const isAdmin = user?.role === 'admin'

  // Single type filter; "all" means no type filter
  const typesFilter = typeFilter === 'all' ? undefined : [typeFilter]
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
  const deleteUser = useDeleteUser()
  const saveConfigMutation = useSaveUserConfig()

  // Only redirect non-admins after auth is initialized; avoid redirecting while user is still loading.
  useEffect(() => {
    if (!authInitialized) return
    if (user != null && user.role !== 'admin') {
      navigate(PathConstants.MAP, { replace: true })
    }
  }, [authInitialized, user, navigate])

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

  const setStatusFilterAndResetPage = (
    value: 'all' | 'active' | 'inactive'
  ) => {
    setStatusFilter(value)
    setPage(1)
  }

  const setTypeFilterAndResetPage = (
    value: 'all' | 'user' | 'shop' | 'event'
  ) => {
    setTypeFilter(value)
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
          interests: configForm.interests ?? [],
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

  const toggleSelectUser = (userId: number) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const selectAllOnPage = (checked: boolean) => {
    if (checked) setSelectedUserIds(new Set(users.map((u: User) => u.user_id)))
    else setSelectedUserIds(new Set())
  }

  const allSelectedOnPage =
    users.length > 0 && users.every((u: User) => selectedUserIds.has(u.user_id))

  const openDeleteConfirm = (userIds: number[], label?: string) => {
    setConfirmModal({ action: 'delete', userIds, label })
    setConfirmInput('')
  }

  const openDisableConfirm = (userIds: number[], label?: string) => {
    setConfirmModal({ action: 'disable', userIds, label })
    setConfirmInput('')
  }

  const closeConfirmModal = () => {
    setConfirmModal(null)
    setConfirmInput('')
  }

  const handleConfirmSubmit = () => {
    if (!confirmModal) return
    const word = CONFIRM_WORDS[confirmModal.action]
    if (confirmInput.trim().toLowerCase() !== word) return

    if (confirmModal.action === 'delete') {
      confirmModal.userIds.forEach((id) => deleteUser.mutate(id))
    } else {
      const toDisable = confirmModal.userIds.filter((id) => {
        const u = users.find((x: User) => x.user_id === id)
        return u?.active === true
      })
      toDisable.forEach((id) => {
        const u = users.find((x: User) => x.user_id === id)
        if (u) toggleActive.mutate({ userId: id, currentActive: u.active })
      })
    }
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      confirmModal.userIds.forEach((id) => next.delete(id))
      return next
    })
    closeConfirmModal()
  }

  const confirmWord = confirmModal ? CONFIRM_WORDS[confirmModal.action] : ''
  const confirmInputValid =
    confirmModal && confirmInput.trim().toLowerCase() === confirmWord

  if (!authInitialized) {
    return (
      <PageLayout title="Users" description="Manage users and config.">
        <p className="text-slate-600">Loading…</p>
      </PageLayout>
    )
  }
  if (user != null && user.role !== 'admin') return null

  return (
    <PageLayout
      title="Users"
      description="Manage users and config (interests, city, subscription)."
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

        {/* Mobile-friendly filters: single row, side-by-side dropdowns */}
        <div className="mb-4 flex items-end gap-2">
          <label className="flex-1 min-w-0">
            <span className="block text-xs font-medium text-slate-600 mb-1">
              Status
            </span>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilterAndResetPage(
                  e.target.value as 'all' | 'active' | 'inactive'
                )
              }
              className={inputClass + ' w-full'}
              aria-label="Filter by status"
            >
              {STATUS_FILTERS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex-1 min-w-0">
            <span className="block text-xs font-medium text-slate-600 mb-1">
              Type
            </span>
            <select
              value={typeFilter}
              onChange={(e) =>
                setTypeFilterAndResetPage(
                  e.target.value as 'all' | 'user' | 'shop' | 'event'
                )
              }
              className={inputClass + ' w-full'}
              aria-label="Filter by user type"
            >
              {USER_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {usersError && <Alert>{(usersError as Error).message}</Alert>}
        {usersLoading ? (
          <LoadingMessage>Loading users…</LoadingMessage>
        ) : (
          <>
            {/* Batch actions when selection is not empty */}
            {selectedUserIds.size > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2 p-3 bg-slate-100 rounded-lg border border-slate-200">
                <span className="text-sm font-medium text-slate-700">
                  {selectedUserIds.size} selected
                </span>
                <button
                  type="button"
                  className={btnToggleClass}
                  onClick={() =>
                    openDisableConfirm(Array.from(selectedUserIds), undefined)
                  }
                  disabled={toggleActive.isPending}
                >
                  Disable selected
                </button>
                <button
                  type="button"
                  className={
                    btnDangerClass + ' inline-flex items-center gap-1.5'
                  }
                  onClick={() =>
                    openDeleteConfirm(Array.from(selectedUserIds), undefined)
                  }
                  disabled={deleteUser.isPending}
                >
                  <CloseDangerIcon />
                  Delete selected
                </button>
                <button
                  type="button"
                  className={btnSecondaryClass}
                  onClick={() => setSelectedUserIds(new Set())}
                >
                  Clear selection
                </button>
              </div>
            )}

            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto">
              <table
                className="w-full min-w-[600px] border-collapse text-sm"
                role="grid"
              >
                <thead>
                  <tr>
                    <th className={tableThClass + ' w-10'}>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allSelectedOnPage}
                          onChange={(e) => selectAllOnPage(e.target.checked)}
                          aria-label="Select all on page"
                          className="rounded border-slate-300"
                        />
                      </label>
                    </th>
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
                      <td className={tableTdClass}>
                        <input
                          type="checkbox"
                          checked={selectedUserIds.has(u.user_id)}
                          onChange={() => toggleSelectUser(u.user_id)}
                          aria-label={`Select ${u.username}`}
                          className="rounded border-slate-300"
                        />
                      </td>
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
                            onClick={() =>
                              u.active
                                ? openDisableConfirm([u.user_id], u.username)
                                : handleToggleActive(u)
                            }
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
                          <button
                            type="button"
                            className={
                              btnDangerClass +
                              ' inline-flex items-center gap-1.5'
                            }
                            onClick={() =>
                              openDeleteConfirm([u.user_id], u.username)
                            }
                            disabled={deleteUser.isPending}
                            aria-label={`Delete ${u.username}`}
                          >
                            <CloseDangerIcon />
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
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.has(u.user_id)}
                        onChange={() => toggleSelectUser(u.user_id)}
                        aria-label={`Select ${u.username}`}
                        className="rounded border-slate-300"
                      />
                      <h3 className="text-base font-semibold text-slate-800 m-0">
                        {u.username}
                      </h3>
                    </label>
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
                      onClick={() =>
                        u.active
                          ? openDisableConfirm([u.user_id], u.username)
                          : handleToggleActive(u)
                      }
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
                    <button
                      type="button"
                      className={
                        btnDangerClass + ' inline-flex items-center gap-1.5'
                      }
                      onClick={() => openDeleteConfirm([u.user_id], u.username)}
                      disabled={deleteUser.isPending}
                      aria-label={`Delete ${u.username}`}
                    >
                      <CloseDangerIcon />
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
        title={configUser ? `User config — ${configUser.username}` : ''}
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
              Interests (comma-separated)
              <input
                type="text"
                value={arrayToComma(config.interests ?? [])}
                onChange={(e) =>
                  handleConfigChange('interests', commaToArray(e.target.value))
                }
                placeholder="e.g. history, coffee, architecture"
                className={inputClass}
              />
              <span className="text-xs text-slate-500 mt-0.5">
                Used for future route and quiz personalization.
              </span>
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

      <Modal
        open={!!confirmModal}
        onClose={closeConfirmModal}
        title={
          confirmModal
            ? confirmModal.action === 'delete'
              ? 'Confirm delete'
              : 'Confirm disable'
            : ''
        }
        titleId="confirm-action-modal-title"
      >
        {confirmModal && (
          <div className="p-5 flex flex-col gap-4">
            <p className="text-sm text-slate-700 m-0">
              {confirmModal.action === 'delete' ? (
                <>
                  This will permanently delete the user
                  {confirmModal.label
                    ? ` "${confirmModal.label}"`
                    : confirmModal.userIds.length > 1
                      ? `s (${confirmModal.userIds.length} users)`
                      : ''}
                  . This action cannot be undone.
                </>
              ) : (
                <>
                  This will disable the selected user
                  {confirmModal.label
                    ? ` "${confirmModal.label}"`
                    : confirmModal.userIds.length > 1
                      ? `s (${confirmModal.userIds.length} users)`
                      : ''}
                  . They will not be able to log in until enabled again.
                </>
              )}
            </p>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Type <strong>{confirmWord}</strong> to confirm:
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder={confirmWord}
                className={inputClass}
                autoComplete="off"
                aria-label={`Type ${confirmWord} to confirm`}
              />
            </label>
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={closeConfirmModal}
                className={btnSecondaryClass}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={!confirmInputValid}
                className={
                  confirmModal.action === 'delete'
                    ? btnDangerClass
                    : btnPrimaryClass
                }
              >
                {confirmModal.action === 'delete' ? 'Delete' : 'Disable'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </PageLayout>
  )
}
