import { useContext, useState, useCallback, useEffect } from 'react'
import { MapContainer, TileLayer, useMapEvents, Marker, Popup } from 'react-leaflet'
import { Icon } from 'leaflet'
import { useNavigate } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import LocationMarker from '../LocationMarker/LocationMarker'
import MyLocation from '../MyLocation/MyLocation'
import MatchMarker from '../MatchMarker/MatchMarker'
import { useUsers } from '../../context/Users.context'
import { AuthContext } from '../../context/Auth.context'
import { useMatchesList } from '../../hooks/useMatchesQueries'
import { useExplorationRoutes, type RouteTypeFilter, type RouteCheckpoint } from '../../hooks/useExplorationQueries'
import PathConstants from '../../routes/pathConstants'
import './MapComponent.css'

const DEFAULT_CENTER: [number, number] = [40.51906594602173, 21.679130381253447]
const MATCHES_RADIUS_M = 50000 // 50 km for admin list

const routePinIcon = new Icon({
  className: 'route-marker',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconSize: [22, 36],
  iconAnchor: [11, 36],
})

function MapCenterUpdater({
  onCenterChange,
  onMapClick,
  pickingPosition,
}: {
  onCenterChange: (lat: number, lng: number) => void
  onMapClick?: (lat: number, lng: number) => void
  pickingPosition: boolean
}) {
  const map = useMapEvents({
    moveend: () => {
      const c = map.getCenter()
      onCenterChange(c.lat, c.lng)
    },
    click: (e) => {
      if (pickingPosition && onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng)
      }
    },
  })
  useEffect(() => {
    const c = map.getCenter()
    onCenterChange(c.lat, c.lng)
  }, [map, onCenterChange])
  return null
}

export default function MapComponent() {
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  const { nearbyUsers } = useUsers()
  const isAdmin = user?.role === 'admin'

  const [routeTypeFilter, setRouteTypeFilter] = useState<RouteTypeFilter>('all')
  const { data: explorationRoutes = [] } = useExplorationRoutes({
    type: routeTypeFilter,
    includeCheckpoints: true,
  })
  const checkpointsWithRoute = explorationRoutes.flatMap((r) =>
    (r.checkpoints ?? []).map((cp: RouteCheckpoint) => ({ route: r, checkpoint: cp }))
  )

  const [mapCenter, setMapCenter] = useState({
    lat: DEFAULT_CENTER[0],
    lng: DEFAULT_CENTER[1],
  })

  const listParams =
    user && mapCenter
      ? {
          lat: mapCenter.lat,
          lng: mapCenter.lng,
          radius: MATCHES_RADIUS_M,
        }
      : null

  const { data: matches = [] } = useMatchesList(listParams)

  const handleCenterChange = useCallback((lat: number, lng: number) => {
    setMapCenter({ lat, lng })
  }, [])

  return (
    <div className="relative w-full">
      {user && (
        <div className="relative z-[10] mb-3 flex flex-wrap items-center gap-3 p-2 bg-white rounded-lg shadow border border-slate-200">
          <label className="flex items-center gap-1 text-sm min-w-0">
            <span className="text-slate-600 hidden sm:inline">Routes:</span>
            <select
              value={routeTypeFilter}
              onChange={(e) => setRouteTypeFilter(e.target.value as RouteTypeFilter)}
              className="border border-slate-300 rounded px-2 py-1 text-sm bg-white max-w-[10rem] sm:max-w-none"
            >
              <option value="all">All</option>
              <option value="real">Real</option>
              <option value="fantasy">Fantasy</option>
            </select>
          </label>
        </div>
      )}

      <MapContainer
        center={DEFAULT_CENTER}
        zoom={15}
        maxZoom={19}
        minZoom={2}
        bounceAtZoomLimits={true}
        maxBoundsViscosity={0.95}
        scrollWheelZoom={false}
      >
        <MapCenterUpdater
          onCenterChange={handleCenterChange}
          onMapClick={undefined}
          pickingPosition={false}
        />
        <TileLayer
          noWrap={false}
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {nearbyUsers.map((u) => (
          <LocationMarker
            key={`user-${u.user_id}`}
            position={[u.latitude, u.longitude]}
            type={u.type}
            name={u.username}
          />
        ))}
        {matches
          .filter((m) => m.zonePosition)
          .map((m) => (
            <MatchMarker key={m.matchId} match={m} />
          ))}
        {checkpointsWithRoute.map(({ route, checkpoint }) => (
          <Marker
            key={checkpoint.id}
            position={[checkpoint.lat, checkpoint.lng]}
            icon={routePinIcon}
          >
            <Popup>
              <div className="text-sm min-w-[200px] max-w-[320px]">
                <p className="font-medium text-slate-800">{route.name}</p>
                <p className="text-slate-500 text-xs">Checkpoint {checkpoint.sequenceOrder + 1} · {route.type ?? 'real'}</p>
                {checkpoint.clueText && (
                  <p className="text-slate-600 text-xs mt-1 line-clamp-2">{checkpoint.clueText}</p>
                )}
                {checkpoint.quiz && (
                  <details className="mt-2 border-t border-slate-200 pt-2">
                    <summary className="cursor-pointer text-xs font-medium text-slate-700 hover:text-slate-900">
                      Question & answers
                    </summary>
                    <div className="mt-1 text-xs">
                      <p className="font-medium text-slate-800 mb-1">{checkpoint.quiz.question}</p>
                      <ul className="list-none space-y-0.5 pl-0">
                        {checkpoint.quiz.options.map((opt: string, i: number) => (
                          <li key={i} className={checkpoint.quiz!.correctAnswerIndex === i ? 'text-emerald-700 font-medium' : 'text-slate-600'}>
                            {checkpoint.quiz!.correctAnswerIndex === i && '✓ '}{opt}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </details>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => navigate(`${PathConstants.EXPLORATION_ROUTES}/${route.id}/edit`)}
                    className="mt-2 text-primary text-xs font-medium hover:underline"
                  >
                    Open route
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
        <MyLocation />
      </MapContainer>

    </div>
  )
}
