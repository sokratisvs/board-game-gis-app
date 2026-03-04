import { useState } from 'react'
import type { MatchType } from '../../hooks/useMatchesQueries'
import Modal from '../ui/Modal'

const MATCH_TYPES: MatchType[] = ['tournament', 'casual', 'campaign', 'other']

type AddMatchModalProps = {
  open: boolean
  onClose: () => void
  onSubmit: (payload: {
    zoneName: string
    zonePosition?: { lat: number; lng: number }
    matchType: string
  }) => void
  pendingPosition: { lat: number; lng: number } | null
  onRequestPickOnMap: () => void
  isSubmitting: boolean
  error: string | null
}

export default function AddMatchModal({
  open,
  onClose,
  onSubmit,
  pendingPosition,
  onRequestPickOnMap,
  isSubmitting,
  error,
}: AddMatchModalProps) {
  const [zoneName, setZoneName] = useState('')
  const [matchType, setMatchType] = useState<MatchType>('casual')
  const [latInput, setLatInput] = useState('')
  const [lngInput, setLngInput] = useState('')

  const position = pendingPosition ?? (latInput && lngInput ? { lat: parseFloat(latInput), lng: parseFloat(lngInput) } : null)
  const hasValidPosition = position && !Number.isNaN(position.lat) && !Number.isNaN(position.lng)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!zoneName.trim()) return
    if (!hasValidPosition) return // location required so match appears on map
    onSubmit({
      zoneName: zoneName.trim(),
      zonePosition: position!,
      matchType,
    })
  }

  return (
    <Modal open={open} onClose={onClose} title="Add match" panelClassName="max-w-md">
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {error && (
          <div className="p-2 rounded bg-red-50 text-red-700 text-sm" role="alert">
            {error}
          </div>
        )}
        <div>
          <label htmlFor="add-match-zone" className="block text-sm font-medium text-slate-700 mb-1">
            Zone / event name
          </label>
          <input
            id="add-match-zone"
            type="text"
            value={zoneName}
            onChange={(e) => setZoneName(e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
            placeholder="e.g. Central Park Arena"
            required
          />
        </div>
        <div>
          <label htmlFor="add-match-type" className="block text-sm font-medium text-slate-700 mb-1">
            Type
          </label>
          <select
            id="add-match-type"
            value={matchType}
            onChange={(e) => setMatchType(e.target.value as MatchType)}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          >
            {MATCH_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="block text-sm font-medium text-slate-700 mb-1">
            Location <span className="text-amber-600">(required — match will show on map)</span>
          </span>
          <button
            type="button"
            onClick={onRequestPickOnMap}
            className="text-sm text-blue-600 hover:underline mb-2"
          >
            Click on map to set location
          </button>
          {pendingPosition && (
            <p className="text-sm text-green-700 mb-1">
              Picked: {pendingPosition.lat.toFixed(4)}, {pendingPosition.lng.toFixed(4)}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="any"
              value={latInput}
              onChange={(e) => setLatInput(e.target.value)}
              placeholder="Latitude"
              className="border border-slate-300 rounded px-3 py-2 text-sm"
            />
            <input
              type="number"
              step="any"
              value={lngInput}
              onChange={(e) => setLngInput(e.target.value)}
              placeholder="Longitude"
              className="border border-slate-300 rounded px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !zoneName.trim() || !hasValidPosition}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Creating…' : 'Create match'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
