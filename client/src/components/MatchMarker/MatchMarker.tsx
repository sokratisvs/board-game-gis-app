import { Icon, LatLngExpression } from 'leaflet'
import { Marker, Tooltip } from 'react-leaflet'
import type { MatchListItem } from '../../hooks/useMatchesQueries'

type MatchMarkerProps = {
  match: MatchListItem
}

const matchIcon = new Icon({
  className: 'match-marker',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

export default function MatchMarker({ match }: MatchMarkerProps) {
  const pos = match.zonePosition
  if (!pos || pos.lat == null || pos.lng == null) return null

  const position: LatLngExpression = [pos.lat, pos.lng]

  return (
    <Marker position={position} icon={matchIcon}>
      <Tooltip permanent={false} direction="top" className="match-marker-tooltip">
        <div className="min-w-[180px] p-2 text-left">
          <p className="font-medium m-0 text-slate-800">{match.zoneName}</p>
          <p className="text-slate-600 text-sm m-0 capitalize">{match.matchType}</p>
          <p className="text-slate-500 text-sm m-0">{match.playerCount} participating</p>
        </div>
      </Tooltip>
    </Marker>
  )
}
