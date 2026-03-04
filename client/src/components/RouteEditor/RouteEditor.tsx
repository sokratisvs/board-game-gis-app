import { useState, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, useMapEvents, Marker } from 'react-leaflet'
import { Icon } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  useRouteDetail,
  useRecommendations,
  useCreateCheckpoint,
  useUpdateCheckpoint,
  useDeleteCheckpoint,
  useDesignSuggest,
  useUpdateRoute,
  type RouteCheckpoint,
  type CreateCheckpointPayload,
  type DesignCheckpointSuggestion,
  type RouteType,
  type RouteDifficulty,
} from '../../hooks/useExplorationQueries'
import PageLayout from '../PageLayout/PageLayout'
import Section from '../ui/Section'
import Alert from '../ui/Alert'
import LoadingMessage from '../ui/LoadingMessage'

const DEFAULT_CENTER: [number, number] = [37.9838, 23.7275]
const inputClass =
  'w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
const labelClass = 'block text-sm font-medium text-slate-700 mb-1'
const btnPrimary =
  'px-3 py-1.5 rounded text-sm font-medium border-none cursor-pointer transition bg-primary text-white hover:bg-primary-hover disabled:opacity-60'
const btnSecondary =
  'px-3 py-1.5 rounded text-sm font-medium border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
const btnDanger =
  'px-3 py-1.5 rounded text-sm font-medium border-none cursor-pointer transition bg-red-600 text-white hover:bg-red-700'

const checkpointIcon = new Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

function MapClickCapture({ onMapClick, enabled }: { onMapClick: (lat: number, lng: number) => void; enabled: boolean }) {
  useMapEvents({
    click: (e) => {
      if (enabled) onMapClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export default function RouteEditor() {
  const { id: routeId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [addingCheckpoint, setAddingCheckpoint] = useState(false)
  const [pendingLatLng, setPendingLatLng] = useState<{ lat: number; lng: number } | null>(null)
  const [editingCheckpoint, setEditingCheckpoint] = useState<RouteCheckpoint | null>(null)
  const [clueText, setClueText] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [knowledgeTitle, setKnowledgeTitle] = useState('')
  const [knowledgeDescription, setKnowledgeDescription] = useState('')
  const [knowledgeFunFact, setKnowledgeFunFact] = useState('')
  const [xpAwardedInput, setXpAwardedInput] = useState('')
  const [recommendationIds, setRecommendationIds] = useState<string[]>([])
  const [quizQuestion, setQuizQuestion] = useState('')
  const [quizOptions, setQuizOptions] = useState<string[]>(['', '', '', ''])
  const [correctAnswerIndex, setCorrectAnswerIndex] = useState(0)
  const [manualLat, setManualLat] = useState('')
  const [manualLng, setManualLng] = useState('')

  const { data: route, isLoading: routeLoading, error: routeError } = useRouteDetail(routeId ?? null)
  const { data: recommendations = [] } = useRecommendations()
  const createCheckpoint = useCreateCheckpoint(routeId ?? null)
  const updateCheckpoint = useUpdateCheckpoint(routeId ?? null, editingCheckpoint?.id ?? null)
  const deleteCheckpoint = useDeleteCheckpoint(routeId ?? null)
  const designSuggest = useDesignSuggest()
  const updateRoute = useUpdateRoute()
  const [aiSuggestions, setAiSuggestions] = useState<DesignCheckpointSuggestion[] | null>(null)
  const [routeType, setRouteType] = useState<RouteType>('real')
  const [routeDifficulty, setRouteDifficulty] = useState<RouteDifficulty>('medium')
  const [routeCity, setRouteCity] = useState('')
  const [routeWorld, setRouteWorld] = useState('')
  const [routeMetaDirty, setRouteMetaDirty] = useState(false)
  const [routeRecommendationIds, setRouteRecommendationIds] = useState<string[]>([])

  const checkpoints = route?.checkpoints ?? []
  const nextOrder = checkpoints.length

  useEffect(() => {
    if (route) {
      setRouteType((route.type as RouteType) ?? 'real')
      setRouteDifficulty((route.difficulty as RouteDifficulty) ?? 'medium')
      setRouteCity(route.city ?? '')
      setRouteWorld(route.world ?? '')
      setRouteRecommendationIds(route.recommendations?.map((r) => r.id) ?? [])
    }
  }, [route?.id, route?.type, route?.difficulty, route?.city, route?.world, route?.recommendations])

  const handleUpdateRouteMeta = () => {
    if (!routeId || !route) return
    updateRoute.mutate(
      {
        id: routeId,
        type: routeType,
        difficulty: routeDifficulty,
        city: routeType === 'real' ? routeCity.trim() || undefined : undefined,
        world: routeType === 'fantasy' ? routeWorld.trim() || undefined : undefined,
        recommendationIds: routeRecommendationIds,
      },
      { onSuccess: () => setRouteMetaDirty(false) }
    )
  }

  const parseXpInput = (v: string): number => {
    const n = parseInt(v.trim(), 10)
    return Number.isNaN(n) || n < 0 ? 0 : n
  }

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (!addingCheckpoint) return
    setPendingLatLng({ lat, lng })
    setQuizQuestion('')
    setQuizOptions(['', '', '', ''])
    setCorrectAnswerIndex(0)
    setXpAwardedInput('')
  }, [addingCheckpoint])

  const openEdit = useCallback((cp: RouteCheckpoint) => {
    setAddingCheckpoint(false)
    setPendingLatLng(null)
    setManualLat('')
    setManualLng('')
    setEditingCheckpoint(cp)
    setClueText(cp.clueText)
    setImageUrl(cp.imageUrl || '')
    setKnowledgeTitle(cp.knowledgeCard?.title || '')
    setKnowledgeDescription(cp.knowledgeCard?.description || '')
    setKnowledgeFunFact(cp.knowledgeCard?.funFact || '')
    const xp = cp.xpAwarded ?? (cp as { xp_awarded?: number }).xp_awarded
    setXpAwardedInput(xp != null ? String(xp) : '')
    setRecommendationIds([])
    setQuizQuestion(cp.quiz?.question ?? '')
    const opts = cp.quiz?.options ?? []
    setQuizOptions([opts[0] ?? '', opts[1] ?? '', opts[2] ?? '', opts[3] ?? ''])
    setCorrectAnswerIndex(Math.max(0, Math.min(cp.quiz?.correctAnswerIndex ?? 0, 3)))
  }, [])

  const saveNewCheckpoint = () => {
    if (!pendingLatLng || !routeId) return
    const options = quizOptions.map((o) => o.trim())
    const hasQuiz = quizQuestion.trim() && options.some(Boolean)
    const payload: CreateCheckpointPayload = {
      sequenceOrder: nextOrder,
      lat: pendingLatLng.lat,
      lng: pendingLatLng.lng,
      clueText: clueText.trim() || 'Clue',
      imageUrl: imageUrl.trim() || null,
      knowledgeCard:
        knowledgeTitle || knowledgeDescription || knowledgeFunFact
          ? { title: knowledgeTitle || undefined, description: knowledgeDescription || undefined, funFact: knowledgeFunFact || undefined }
          : null,
      xpAwarded: parseXpInput(xpAwardedInput),
      recommendationIds: recommendationIds.length ? recommendationIds : undefined,
      quiz: hasQuiz
        ? {
            question: quizQuestion.trim(),
            options: options.length >= 4 ? options : [...options, ...Array(4).fill('')].slice(0, 4),
            correctAnswerIndex: Math.max(0, Math.min(correctAnswerIndex, 3)),
          }
        : undefined,
    }
    createCheckpoint.mutate(payload, {
      onSuccess: () => {
        setPendingLatLng(null)
        setAddingCheckpoint(false)
        setClueText('')
        setImageUrl('')
        setKnowledgeTitle('')
        setKnowledgeDescription('')
        setKnowledgeFunFact('')
        setXpAwardedInput('')
        setRecommendationIds([])
        setQuizQuestion('')
        setQuizOptions(['', '', '', ''])
        setCorrectAnswerIndex(0)
      },
    })
  }

  const saveEditCheckpoint = () => {
    if (!editingCheckpoint || !routeId) return
    const options = quizOptions.map((o) => o.trim())
    const hasQuiz = quizQuestion.trim() && options.some(Boolean)
    updateCheckpoint.mutate(
      {
        clueText: clueText.trim() || editingCheckpoint.clueText,
        imageUrl: imageUrl.trim() || null,
        knowledgeCard:
          knowledgeTitle || knowledgeDescription || knowledgeFunFact
            ? { title: knowledgeTitle || undefined, description: knowledgeDescription || undefined, funFact: knowledgeFunFact || undefined }
            : null,
        xpAwarded: parseXpInput(xpAwardedInput),
        recommendationIds,
        quiz: hasQuiz
          ? {
              question: quizQuestion.trim(),
              options: options.length >= 4 ? options : [...options, ...Array(4).fill('')].slice(0, 4),
              correctAnswerIndex: Math.max(0, Math.min(correctAnswerIndex, 3)),
            }
          : undefined,
      },
      {
        onSuccess: () => {
          setEditingCheckpoint(null)
        },
      }
    )
  }

  const removeCheckpoint = (cp: RouteCheckpoint) => {
    if (!window.confirm('Remove this checkpoint?')) return
    deleteCheckpoint.mutate(cp.id)
    setEditingCheckpoint(null)
  }

  const handleSuggestWithAi = () => {
    if (!route) return
    designSuggest.mutate(
      { name: route.name, description: route.description || undefined },
      { onSuccess: (data) => setAiSuggestions(data.checkpoints?.length ? data.checkpoints : null) }
    )
  }

  const applySuggestion = (c: DesignCheckpointSuggestion) => {
    setClueText(c.clueText)
    setKnowledgeTitle(c.knowledgeCard?.title || '')
    setKnowledgeDescription(c.knowledgeCard?.description || '')
    setKnowledgeFunFact(c.knowledgeCard?.funFact || '')
    const xp = c.xpAwarded
    setXpAwardedInput(xp != null ? String(xp) : '')
  }


  if (!routeId) {
    return (
      <PageLayout title="Edit route">
        <Alert variant="error">Missing route ID</Alert>
      </PageLayout>
    )
  }

  if (routeLoading || !route) {
    return (
      <PageLayout title="Edit route">
        <LoadingMessage>Loading route…</LoadingMessage>
      </PageLayout>
    )
  }

  if (routeError) {
    return (
      <PageLayout title="Edit route">
        <Alert variant="error">{routeError instanceof Error ? routeError.message : 'Failed to load route'}</Alert>
      </PageLayout>
    )
  }

  const totalXp = checkpoints.reduce((sum, c) => sum + (c.xpAwarded ?? 0), 0)

  return (
    <PageLayout
      title={route.name}
      description={`Add checkpoints by clicking the map or entering lat/lng. Set clue, quiz, knowledge card, and XP for each pin. Total XP for mobile: ${totalXp}`}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => navigate('/exploration/routes')}
          className={btnSecondary}
        >
          ← Back to routes
        </button>
        {!addingCheckpoint && !pendingLatLng && (
          <button
            type="button"
            onClick={() => setAddingCheckpoint(true)}
            className={btnPrimary}
          >
            Add checkpoint on map
          </button>
        )}
        <button
          type="button"
          onClick={handleSuggestWithAi}
          disabled={!route || designSuggest.isPending}
          className="px-3 py-1.5 rounded text-sm font-medium border border-emerald-600 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
        >
          {designSuggest.isPending ? 'Asking AI…' : 'Suggest with AI'}
        </button>
        {designSuggest.isError && (
          <span className="text-sm text-red-600">{designSuggest.error?.message}</span>
        )}
        {addingCheckpoint && !pendingLatLng && (
          <>
            <span className="text-sm text-slate-600">Click on the map to place checkpoint #{nextOrder + 1}</span>
            <span className="text-sm text-slate-400">or</span>
            <input
              type="number"
              step="any"
              placeholder="Lat"
              value={manualLat}
              onChange={(e) => setManualLat(e.target.value)}
              className="w-24 px-2 py-1 border border-slate-300 rounded text-sm"
            />
            <input
              type="number"
              step="any"
              placeholder="Lng"
              value={manualLng}
              onChange={(e) => setManualLng(e.target.value)}
              className="w-24 px-2 py-1 border border-slate-300 rounded text-sm"
            />
            <button
              type="button"
              onClick={() => {
                const lat = parseFloat(manualLat)
                const lng = parseFloat(manualLng)
                if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
                  setPendingLatLng({ lat, lng })
                  setQuizQuestion('')
                  setQuizOptions(['', '', '', ''])
                  setCorrectAnswerIndex(0)
                }
              }}
              disabled={Number.isNaN(parseFloat(manualLat)) || Number.isNaN(parseFloat(manualLng))}
              className={btnSecondary}
            >
              Use coordinates
            </button>
          </>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <Section title="" className="flex-1 min-h-[400px]">
          <div className="rounded-lg overflow-hidden border border-slate-200" style={{ minHeight: 400 }}>
            <MapContainer
              center={DEFAULT_CENTER}
              zoom={13}
              style={{ height: 400, width: '100%' }}
              scrollWheelZoom
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapClickCapture onMapClick={handleMapClick} enabled={!!addingCheckpoint && !pendingLatLng} />
              {checkpoints.map((cp) => (
                <Marker
                  key={cp.id}
                  position={[cp.lat, cp.lng]}
                  icon={checkpointIcon}
                  eventHandlers={{ click: () => openEdit(cp) }}
                />
              ))}
              {pendingLatLng && (
                <Marker position={[pendingLatLng.lat, pendingLatLng.lng]} icon={checkpointIcon} />
              )}
            </MapContainer>
          </div>
        </Section>

        <div className="w-full lg:w-96 space-y-4">
          {(pendingLatLng || editingCheckpoint) && (
            <Section title={editingCheckpoint ? 'Edit checkpoint' : `New checkpoint #${nextOrder + 1}`}>
              <label className={labelClass}>Clue text</label>
              <textarea
                value={clueText}
                onChange={(e) => setClueText(e.target.value)}
                placeholder="Seek the garden where kings once walked..."
                className={inputClass + ' mb-2'}
                rows={3}
              />
              <label className={labelClass}>Image URL (photo of place)</label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className={inputClass + ' mb-2'}
              />
              <label className={labelClass}>Knowledge card: title</label>
              <input
                type="text"
                value={knowledgeTitle}
                onChange={(e) => setKnowledgeTitle(e.target.value)}
                placeholder="The Old Palace of Greece"
                className={inputClass + ' mb-2'}
              />
              <label className={labelClass}>Knowledge card: description</label>
              <textarea
                value={knowledgeDescription}
                onChange={(e) => setKnowledgeDescription(e.target.value)}
                placeholder="..."
                className={inputClass + ' mb-2'}
                rows={2}
              />
              <label className={labelClass}>Knowledge card: fun fact</label>
              <input
                type="text"
                value={knowledgeFunFact}
                onChange={(e) => setKnowledgeFunFact(e.target.value)}
                placeholder="..."
                className={inputClass + ' mb-2'}
              />
              <label className={labelClass}>XP awarded (optional, 0 if empty)</label>
              <input
                type="number"
                min={0}
                value={xpAwardedInput}
                onChange={(e) => setXpAwardedInput(e.target.value)}
                placeholder="0"
                className={inputClass + ' mb-2'}
              />
              <div className="border-t border-slate-200 pt-3 mt-3">
                <label className={labelClass}>Quiz question</label>
                <input
                  type="text"
                  value={quizQuestion}
                  onChange={(e) => setQuizQuestion(e.target.value)}
                  placeholder="What stands at the heart of this square, symbolizing renewal?"
                  className={inputClass + ' mb-2'}
                />
                <label className={labelClass}>Options (select correct answer)</label>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2 mb-1">
                    <input
                      type="radio"
                      name="correctAnswer"
                      checked={correctAnswerIndex === i}
                      onChange={() => setCorrectAnswerIndex(i)}
                      className="shrink-0"
                    />
                    <input
                      type="text"
                      value={quizOptions[i] ?? ''}
                      onChange={(e) =>
                        setQuizOptions((prev) => {
                          const next = [...prev]
                          next[i] = e.target.value
                          return next
                        })
                      }
                      placeholder={i === 0 ? 'A marble statue' : i === 1 ? 'A central fountain' : i === 2 ? 'An ancient altar' : 'A clock tower'}
                      className={inputClass}
                    />
                  </div>
                ))}
              </div>
              <label className={labelClass}>Nearby recommendations</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {recommendations.map((rec) => (
                  <label key={rec.id} className="inline-flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={recommendationIds.includes(rec.id)}
                      onChange={(e) =>
                        setRecommendationIds((prev) =>
                          e.target.checked ? [...prev, rec.id] : prev.filter((id) => id !== rec.id)
                        )
                      }
                    />
                    {rec.type}: {rec.name || rec.externalId || rec.id.slice(0, 8)}
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {pendingLatLng ? (
                  <>
                    <button
                      type="button"
                      onClick={saveNewCheckpoint}
                      disabled={createCheckpoint.isPending}
                      className={btnPrimary}
                    >
                      {createCheckpoint.isPending ? 'Adding…' : 'Add checkpoint'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingLatLng(null)
                        setAddingCheckpoint(false)
                        setQuizQuestion('')
                        setQuizOptions(['', '', '', ''])
                        setCorrectAnswerIndex(0)
                        setXpAwardedInput('')
                        setManualLat('')
                        setManualLng('')
                      }}
                      className={btnSecondary}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={saveEditCheckpoint}
                      disabled={updateCheckpoint.isPending}
                      className={btnPrimary}
                    >
                      {updateCheckpoint.isPending ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => editingCheckpoint && removeCheckpoint(editingCheckpoint)}
                      className={btnDanger}
                    >
                      Remove checkpoint
                    </button>
                    <button type="button" onClick={() => setEditingCheckpoint(null)} className={btnSecondary}>
                      Close
                    </button>
                  </>
                )}
              </div>
            </Section>
          )}

          <Section title="Route details">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label className={labelClass}>Type</label>
                <select
                  value={routeType}
                  onChange={(e) => { setRouteType(e.target.value as RouteType); setRouteMetaDirty(true) }}
                  className={inputClass}
                >
                  <option value="real">Real</option>
                  <option value="fantasy">Fantasy</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Difficulty</label>
                <select
                  value={routeDifficulty}
                  onChange={(e) => { setRouteDifficulty(e.target.value as RouteDifficulty); setRouteMetaDirty(true) }}
                  className={inputClass}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>
            {routeType === 'real' && (
              <div className="mb-2">
                <label className={labelClass}>City</label>
                <input
                  type="text"
                  value={routeCity}
                  onChange={(e) => { setRouteCity(e.target.value); setRouteMetaDirty(true) }}
                  placeholder="e.g. Athens"
                  className={inputClass}
                />
              </div>
            )}
            {routeType === 'fantasy' && (
              <div className="mb-2">
                <label className={labelClass}>World</label>
                <input
                  type="text"
                  value={routeWorld}
                  onChange={(e) => { setRouteWorld(e.target.value); setRouteMetaDirty(true) }}
                  placeholder="e.g. Middle Earth"
                  className={inputClass}
                />
              </div>
            )}
            <div className="mb-2">
              <label className={labelClass}>Route recommendations (for mobile)</label>
              <div className="flex flex-wrap gap-2">
                {recommendations.map((rec) => (
                  <label key={rec.id} className="inline-flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={routeRecommendationIds.includes(rec.id)}
                      onChange={(e) => {
                        setRouteMetaDirty(true)
                        setRouteRecommendationIds((prev) =>
                          e.target.checked ? [...prev, rec.id] : prev.filter((id) => id !== rec.id)
                        )
                      }}
                      className="rounded border-slate-300"
                    />
                    <span>{rec.name || rec.type || rec.id.slice(0, 8)}</span>
                  </label>
                ))}
                {recommendations.length === 0 && (
                  <span className="text-sm text-slate-500">No recommendations in the system. Add some in admin.</span>
                )}
              </div>
            </div>
            {routeMetaDirty && (
              <button
                type="button"
                onClick={handleUpdateRouteMeta}
                disabled={updateRoute.isPending}
                className={btnPrimary}
              >
                {updateRoute.isPending ? 'Saving…' : 'Save route details'}
              </button>
            )}
          </Section>

          {aiSuggestions && aiSuggestions.length > 0 && (
            <Section title="AI suggestions">
              <p className="text-sm text-slate-600 mb-2">Click &quot;Use&quot; to pre-fill the new checkpoint form, then place the pin on the map.</p>
              <ul className="list-none p-0 m-0 space-y-2 mb-2">
                {aiSuggestions.map((c, i) => (
                  <li key={i} className="p-2 rounded border border-slate-200 bg-slate-50 text-sm">
                    <span className="font-medium">#{c.sequenceOrder + 1}</span> {c.placeName && `(${c.placeName})`}
                    <p className="m-0 mt-1 text-slate-700">{c.clueText.slice(0, 60)}{c.clueText.length > 60 ? '…' : ''}</p>
                    <button
                      type="button"
                      onClick={() => applySuggestion(c)}
                      className="mt-1 text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                    >
                      Use
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => setAiSuggestions(null)} className="text-sm text-slate-500 hover:text-slate-700">
                Dismiss
              </button>
            </Section>
          )}

          <Section title="Checkpoints">
            <ul className="list-none p-0 m-0 space-y-2">
              {checkpoints.map((cp) => (
                <li
                  key={cp.id}
                  className={`p-2 rounded border cursor-pointer ${editingCheckpoint?.id === cp.id ? 'border-primary bg-primary/5' : 'border-slate-200 hover:bg-slate-50'}`}
                  onClick={() => openEdit(cp)}
                >
                  <span className="font-medium">#{cp.sequenceOrder + 1}</span> {cp.clueText.slice(0, 50)}
                  {cp.clueText.length > 50 ? '…' : ''} · {cp.xpAwarded} XP
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>
    </PageLayout>
  )
}
