import type { MatchDetail } from '../../hooks/useMatchesQueries'
import Modal from '../ui/Modal'

type MatchDetailModalProps = {
  open: boolean
  onClose: () => void
  match: MatchDetail | null
  loading: boolean
}

export default function MatchDetailModal({
  open,
  onClose,
  match,
  loading,
}: MatchDetailModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Match details" panelClassName="max-w-md">
      <div className="p-4">
        {loading && <p className="text-slate-500 text-sm">Loading…</p>}
        {!loading && !match && <p className="text-slate-500 text-sm">Match not found.</p>}
        {!loading && match && (
          <>
            <p className="font-medium text-slate-800 m-0">{match.zoneName}</p>
            <p className="text-slate-600 text-sm m-0 capitalize">Type: {match.matchType}</p>
            {match.zonePosition && (
              <p className="text-slate-500 text-sm m-0">
                Location: {match.zonePosition.lat.toFixed(4)}, {match.zonePosition.lng.toFixed(4)}
              </p>
            )}
            <h3 className="text-sm font-semibold text-slate-700 mt-4 mb-2">
              Participants ({match.players.length})
            </h3>
            <ul className="list-none p-0 m-0 space-y-1">
              {match.players.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between py-1.5 px-2 rounded bg-slate-50 text-sm"
                >
                  <span>{p.displayName}</span>
                  {p.isCurrentTurn && (
                    <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                      Current turn
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Modal>
  )
}
