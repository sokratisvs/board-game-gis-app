import { useContext, useState, useCallback } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { AuthContext } from '../../context/Auth.context'
import {
  useMatchesList,
  useUpdateMatch,
  useDeleteMatch,
  type MatchListItem,
  type MatchType,
  type UpdateMatchPayload,
} from '../../hooks/useMatchesQueries'
import PageLayout from '../PageLayout/PageLayout'
import Section from '../ui/Section'
import Alert from '../ui/Alert'
import LoadingMessage from '../ui/LoadingMessage'
import Modal from '../ui/Modal'

const MATCH_TYPES: Array<{ value: ''; label: string } | { value: MatchType; label: string }> = [
  { value: '', label: 'All types' },
  { value: 'tournament', label: 'Tournament' },
  { value: 'casual', label: 'Casual' },
  { value: 'campaign', label: 'Campaign' },
  { value: 'other', label: 'Other' },
]

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

const inputClass =
  'w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
const labelClass = 'block text-sm font-medium text-slate-700 mb-1'
const btnPrimary =
  'px-3 py-1.5 rounded text-sm font-medium border-none cursor-pointer transition bg-primary text-white hover:bg-primary-hover disabled:opacity-60'
const btnSecondary =
  'px-3 py-1.5 rounded text-sm font-medium border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
const btnDanger =
  'px-3 py-1.5 rounded text-sm font-medium border-none cursor-pointer transition bg-red-600 text-white hover:bg-red-700'

export default function Matches() {
  const { user } = useContext(AuthContext)
  const isAdmin = user?.role === 'admin'

  const [typeFilter, setTypeFilter] = useState<string>('')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
   const [searchQuery, setSearchQuery] = useState<string>('')
  const [editingMatch, setEditingMatch] = useState<MatchListItem | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const listParams: import('../../hooks/useMatchesQueries').MatchesListParams = {
    type: typeFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }

  const { data: matches = [], isLoading, error } = useMatchesList(listParams)
  const updateMatch = useUpdateMatch()
  const deleteMatch = useDeleteMatch()

  const normalizedSearch = searchQuery.trim().toLowerCase()
  const filteredMatches = normalizedSearch
    ? matches.filter((m) => (m.zoneName || '').toLowerCase().includes(normalizedSearch))
    : matches

  const handleEditSubmit = useCallback(
    (payload: UpdateMatchPayload) => {
      if (!editingMatch) return
      updateMatch.mutate(
        { matchId: editingMatch.matchId, ...payload },
        {
          onSuccess: () => {
            setEditingMatch(null)
          },
        }
      )
    },
    [editingMatch, updateMatch]
  )

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteConfirmId) return
    deleteMatch.mutate(deleteConfirmId, {
      onSettled: () => setDeleteConfirmId(null),
    })
  }, [deleteConfirmId, deleteMatch])

  return (
    <PageLayout
      title="Matches"
      description="Browse and filter matches. Admins can edit or delete."
    >
      <Section title="" className="mb-4">
        {/* Search by event name (admin-style, but visible to all) */}
        <div className="mb-4">
          <label
            htmlFor="matches-search"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Search by event name
          </label>
          <div className="relative inline-block w-full max-w-sm">
            <input
              id="matches-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type to filter by event name…"
              className={
                inputClass +
                ' w-full pr-12 [&::-webkit-search-cancel-button]:appearance-none'
              }
              aria-label="Search by event name"
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
          <p className="text-xs text-slate-500 mt-1 m-0">
            Results update as you type (search is case-insensitive).
          </p>
        </div>

        {/* Filters: type + date range; dates side by side like Users status/type */}
        <div className="flex flex-col gap-3">
          <label className="flex flex-col max-w-xs sm:max-w-sm">
            <span className={labelClass}>Type</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className={inputClass + ' w-full'}
            >
              {MATCH_TYPES.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <label className="flex-1 min-w-0">
              <span className="block text-xs font-medium text-slate-600 mb-1">
                From date
              </span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={inputClass + ' w-full'}
              />
            </label>
            <label className="flex-1 min-w-0">
              <span className="block text-xs font-medium text-slate-600 mb-1">
                To date
              </span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={inputClass + ' w-full'}
              />
            </label>
          </div>
        </div>
      </Section>

      {error && (
        <Alert variant="error" className="mb-4">
          {error instanceof Error ? error.message : 'Failed to load matches'}
        </Alert>
      )}

      {isLoading && <LoadingMessage message="Loading matches…" />}

      {!isLoading && (
        <Section title="">
          {/* Desktop/tablet: table view */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="p-3 text-left font-semibold text-slate-600">Event</th>
                  <th className="p-3 text-left font-semibold text-slate-600">Type</th>
                  <th className="p-3 text-left font-semibold text-slate-600">Start</th>
                  <th className="p-3 text-left font-semibold text-slate-600">End</th>
                  <th className="p-3 text-left font-semibold text-slate-600">Game</th>
                  <th className="p-3 text-left font-semibold text-slate-600">Players</th>
                  {isAdmin && (
                    <th className="p-3 text-left font-semibold text-slate-600 w-28">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredMatches.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} className="p-6 text-center text-slate-500">
                      No matches found.
                    </td>
                  </tr>
                ) : (
                  filteredMatches.map((m) => (
                    <tr key={m.matchId} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-3">{m.zoneName || '—'}</td>
                      <td className="p-3 capitalize">{m.matchType || '—'}</td>
                      <td className="p-3">{formatDateTime(m.startTime ?? undefined)}</td>
                      <td className="p-3">{formatDateTime(m.endTime ?? undefined)}</td>
                      <td className="p-3">{m.gameName || '—'}</td>
                      <td className="p-3">{m.playerCount}</td>
                      {isAdmin && (
                        <td className="p-3">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingMatch(m)}
                              className={btnSecondary}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(m.matchId)}
                              className={btnDanger}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile: card list similar to Users page */}
          <ul className="md:hidden list-none p-0 m-0 space-y-3" role="list">
            {filteredMatches.length === 0 ? (
              <li className="border border-dashed border-slate-300 rounded-lg p-4 text-center text-sm text-slate-500">
                No matches found.
              </li>
            ) : (
              filteredMatches.map((m) => (
                <li
                  key={m.matchId}
                  className="bg-slate-50 rounded-lg border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <h3 className="text-base font-semibold text-slate-800 m-0">
                      {m.zoneName || 'Unnamed event'}
                    </h3>
                    <span
                      className={
                        'inline-block px-2 py-1 rounded-full text-xs font-semibold capitalize ' +
                        'bg-blue-100 text-blue-800'
                      }
                    >
                      {m.matchType || 'other'}
                    </span>
                  </div>
                  <dl className="text-xs text-slate-600 space-y-1 m-0">
                    <div className="flex justify-between gap-2">
                      <dt className="font-semibold">Start</dt>
                      <dd className="m-0 text-right">
                        {formatDateTime(m.startTime ?? undefined)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="font-semibold">End</dt>
                      <dd className="m-0 text-right">
                        {formatDateTime(m.endTime ?? undefined)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="font-semibold">Game</dt>
                      <dd className="m-0 text-right">{m.gameName || '—'}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="font-semibold">Players</dt>
                      <dd className="m-0 text-right">{m.playerCount}</dd>
                    </div>
                  </dl>
                  {isAdmin && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => setEditingMatch(m)}
                        className={btnSecondary + ' flex-1 min-w-[5rem] text-center'}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(m.matchId)}
                        className={btnDanger + ' flex-1 min-w-[5rem] text-center'}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </li>
              ))
            )}
          </ul>
        </Section>
      )}

      {editingMatch && (
        <EditMatchModal
          match={editingMatch}
          onClose={() => setEditingMatch(null)}
          onSubmit={handleEditSubmit}
          isPending={updateMatch.isPending}
          error={updateMatch.error}
        />
      )}

      {deleteConfirmId && (
        <Modal
          open
          onClose={() => setDeleteConfirmId(null)}
          title="Delete match?"
          titleId="delete-match-title"
        >
          <p className="p-4 text-slate-600">
            This will permanently delete the match and its players. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2 p-4 border-t border-slate-200">
            <button type="button" onClick={() => setDeleteConfirmId(null)} className={btnSecondary}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              disabled={deleteMatch.isPending}
              className={btnDanger}
            >
              {deleteMatch.isPending ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}
    </PageLayout>
  )
}

type EditMatchModalProps = {
  match: MatchListItem
  onClose: () => void
  onSubmit: (payload: UpdateMatchPayload) => void
  isPending: boolean
  error: Error | null
}

function EditMatchModal({ match, onClose, onSubmit, isPending, error }: EditMatchModalProps) {
  const [zoneName, setZoneName] = useState(match.zoneName)
  const [matchType, setMatchType] = useState(match.matchType || 'other')
  const [startTime, setStartTime] = useState<Date | null>(
    match.startTime ? new Date(match.startTime) : null
  )
  const [endTime, setEndTime] = useState<Date | null>(
    match.endTime ? new Date(match.endTime) : null
  )
  const [gameName, setGameName] = useState(match.gameName || '')

  const isTimeRangeInvalid =
    startTime && endTime && endTime.getTime() <= startTime.getTime()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isTimeRangeInvalid) return
    onSubmit({
      zoneName: zoneName.trim(),
      matchType,
      startTime: startTime ? startTime.toISOString() : null,
      endTime: endTime ? endTime.toISOString() : null,
      gameName: gameName.trim() || null,
    })
  }

  return (
    <Modal open onClose={onClose} title="Edit match" titleId="edit-match-title" panelClassName="max-w-md">
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <label className="block">
          <span className={labelClass}>Event name</span>
          <input
            type="text"
            value={zoneName}
            onChange={(e) => setZoneName(e.target.value)}
            className={inputClass}
            required
          />
        </label>
        <label className="block">
          <span className={labelClass}>Type</span>
          <select
            value={matchType}
            onChange={(e) => setMatchType(e.target.value)}
            className={inputClass}
          >
            <option value="tournament">Tournament</option>
            <option value="casual">Casual</option>
            <option value="campaign">Campaign</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Start time</span>
          <DatePicker
            selected={startTime}
            onChange={(d: Date | null) => setStartTime(d)}
            showTimeSelect
            timeIntervals={15}
            dateFormat="Pp"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>End time</span>
          <DatePicker
            selected={endTime}
            onChange={(d: Date | null) => setEndTime(d)}
            showTimeSelect
            timeIntervals={15}
            dateFormat="Pp"
            className={inputClass}
          />
        </label>
        {isTimeRangeInvalid && (
          <p className="text-sm text-red-600">End time must be after start time.</p>
        )}
        <label className="block">
          <span className={labelClass}>Game</span>
          <input
            type="text"
            value={gameName}
            onChange={(e) => setGameName(e.target.value)}
            className={inputClass}
            placeholder="e.g. Catan"
          />
        </label>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error instanceof Error ? error.message : 'Update failed'}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending || isTimeRangeInvalid || !zoneName.trim()}
            className={btnPrimary}
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
