import { useContext, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../../context/Auth.context'
import {
  useExplorationRoutes,
  useCreateRoute,
  useCreateRouteFromDesign,
  useCreateRouteFromBatch,
  useDesignSuggest,
  useDeleteRoute,
  type ExplorationRoute,
  type DesignCheckpointSuggestion,
  type RouteContentType,
  type RouteDifficulty,
  type CreateFromBatchPayload,
} from '../../hooks/useExplorationQueries'
import PageLayout from '../PageLayout/PageLayout'
import Section from '../ui/Section'
import Alert from '../ui/Alert'
import LoadingMessage from '../ui/LoadingMessage'
import PathConstants from '../../routes/pathConstants'

const btnPrimary =
  'px-3 py-1.5 rounded text-sm font-medium border-none cursor-pointer transition bg-primary text-white hover:bg-primary-hover disabled:opacity-60'
const btnSecondary =
  'px-3 py-1.5 rounded text-sm font-medium border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
const btnDanger =
  'px-3 py-1.5 rounded text-sm font-medium border-none cursor-pointer transition bg-red-600 text-white hover:bg-red-700'
const inputClass =
  'w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'

export default function ExplorationRoutes() {
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  const isAdmin = user?.role === 'admin'

  const { data: routes = [], isLoading, error } = useExplorationRoutes()
  const createRoute = useCreateRoute()
  const createFromDesign = useCreateRouteFromDesign()
  const createFromBatch = useCreateRouteFromBatch()
  const designSuggest = useDesignSuggest()
  const deleteRoute = useDeleteRoute()

  type CreateMode = 'ai' | 'manual' | 'batch'
  const [showCreate, setShowCreate] = useState(false)
  const [createMode, setCreateMode] = useState<CreateMode>('manual')
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newType, setNewType] = useState<RouteContentType>('history')
  const [newDifficulty, setNewDifficulty] = useState<RouteDifficulty>('medium')
  const [newCity, setNewCity] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [aiSuggestions, setAiSuggestions] = useState<DesignCheckpointSuggestion[] | null>(null)
  const [batchJson, setBatchJson] = useState('')
  const [batchParseError, setBatchParseError] = useState<string | null>(null)
  const [batchImporting, setBatchImporting] = useState(false)

  const handleCreate = () => {
    if (!newName.trim()) return
    createRoute.mutate(
      {
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        difficulty: newDifficulty,
        type: newType,
        city: newCity.trim() || undefined,
      },
      {
        onSuccess: (route) => {
          setShowCreate(false)
          setNewName('')
          setNewDescription('')
          setNewCity('')
          navigate(PathConstants.explorationRouteEdit(route.id))
        },
      }
    )
  }

  const handleDesignWithAi = () => {
    if (!newName.trim()) return
    if (!user) {
      return
    }
    if (!isAdmin) {
      return
    }
    designSuggest.mutate(
      { name: newName.trim(), description: newDescription.trim() || undefined },
      {
        onSuccess: (data) => {
          setAiSuggestions(data.checkpoints?.length ? data.checkpoints : null)
        },
      }
    )
  }

  const designSuggestStatus = (designSuggest.error as { response?: { status?: number } } | null)?.response?.status
  const designSuggestAuthError =
    designSuggestStatus === 401
      ? 'Please log in to use Design with AI.'
      : designSuggestStatus === 403
        ? 'Admin access required for Design with AI.'
        : null

  const handleConfirmCreateFromDesign = () => {
    if (!newName.trim() || !aiSuggestions?.length) return
    createFromDesign.mutate(
      {
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        is_public: true,
        difficulty: newDifficulty,
        type: newType,
        city: newCity.trim() || undefined,
        checkpoints: aiSuggestions,
      },
      {
        onSuccess: (route) => {
          setAiSuggestions(null)
          setShowCreate(false)
          setNewName('')
          setNewDescription('')
          setNewCity('')
          navigate(PathConstants.explorationRouteEdit(route.id))
        },
      }
    )
  }

  const handleDeleteConfirm = () => {
    if (!deleteConfirmId) return
    deleteRoute.mutate(deleteConfirmId, { onSettled: () => setDeleteConfirmId(null) })
  }

  /** Read imageUrl from a route or checkpoint object (accepts imageUrl or image_url). */
  function readImageUrl(obj: Record<string, unknown>): string | undefined {
    const v = obj.imageUrl ?? obj.image_url
    if (v == null) return undefined
    const s = String(v).trim()
    return s || undefined
  }

  /** Parse one route object from batch JSON into CreateFromBatchPayload (name, imageUrl, checkpoints with coords/quiz/imageUrl). */
  function parseOneBatch(parsed: Record<string, unknown>, fallbackName: string, index: number, total: number): { payload: CreateFromBatchPayload } | { error: string } {
    const nameFromJson = (parsed.name ?? parsed.title) as string | undefined
    const name =
      (nameFromJson && String(nameFromJson).trim()) ||
      fallbackName.trim() ||
      (total === 1 ? 'Imported route' : `Route ${index + 1}`)
    const checkpoints = parsed.checkpoints as CreateFromBatchPayload['checkpoints'] | undefined
    if (!Array.isArray(checkpoints) || checkpoints.length === 0) {
      return { error: 'JSON must include "checkpoints" array with at least one checkpoint' }
    }
    const routeImageUrl = readImageUrl(parsed)
    const payload: CreateFromBatchPayload = {
      name,
      title: name,
      description: parsed.description != null ? String(parsed.description) : undefined,
      imageUrl: routeImageUrl,
      city: parsed.city != null ? String(parsed.city) : undefined,
      radiusMeters: parsed.radiusMeters != null ? Number(parsed.radiusMeters) : undefined,
      estimatedDurationMin: parsed.estimatedDurationMin != null ? Number(parsed.estimatedDurationMin) : undefined,
      difficulty: (['easy', 'medium', 'hard'].includes(parsed.difficulty as string) ? parsed.difficulty : 'medium') as RouteDifficulty,
      type: (['history', 'literature', 'culture', 'architecture', 'sports'].includes(parsed.type as string) ? parsed.type : (['history', 'literature', 'culture', 'architecture', 'sports'].includes(parsed.theme as string) ? parsed.theme : 'history')) as RouteContentType,
      checkpoints: checkpoints.map((c) => {
        return {
          order: Number(c.order ?? 0),
          coordinates: c.coordinates && typeof c.coordinates === 'object' ? { lat: Number(c.coordinates.lat), lng: Number(c.coordinates.lng) } : { lat: 0, lng: 0 },
          validationRadiusMeters: c.validationRadiusMeters != null ? Number(c.validationRadiusMeters) : undefined,
          imageUrl: readImageUrl(c as Record<string, unknown>),
          quiz: c.quiz && typeof c.quiz === 'object' ? {
            question: String(c.quiz.question ?? ''),
            options: Array.isArray(c.quiz.options) ? c.quiz.options.map(String) : [],
            correctAnswerIndex: Number(c.quiz.correctAnswerIndex ?? 0),
          } : { question: '', options: [], correctAnswerIndex: 0 },
        }
      }),
    }
    return { payload }
  }

  const handleImportBatch = async () => {
    setBatchParseError(null)
    let parsed: unknown
    try {
      parsed = JSON.parse(batchJson)
    } catch {
      setBatchParseError('Invalid JSON')
      return
    }
    const items: Record<string, unknown>[] = Array.isArray(parsed) ? parsed : [parsed as Record<string, unknown>]
    const payloads: CreateFromBatchPayload[] = []
    for (let i = 0; i < items.length; i++) {
      const result = parseOneBatch(items[i], newName.trim(), i, items.length)
      if ('error' in result) {
        setBatchParseError(items.length > 1 ? `Route ${i + 1}: ${result.error}` : result.error)
        return
      }
      payloads.push(result.payload)
    }
    if (payloads.length === 0) {
      setBatchParseError('No route(s) to import')
      return
    }
    setBatchImporting(true)
    try {
      let lastRoute: { id: string } | null = null
      for (let i = 0; i < payloads.length; i++) {
        lastRoute = await createFromBatch.mutateAsync(payloads[i])
      }
      setBatchJson('')
      setBatchParseError(null)
      setShowCreate(false)
      setNewName('')
      if (lastRoute) navigate(PathConstants.explorationRouteEdit(lastRoute.id))
    } catch (err) {
      setBatchParseError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setBatchImporting(false)
    }
  }

  return (
    <PageLayout
      title="Quiz routes"
      description="Quiz routes by type (history, literature, culture, architecture, sports). Admin can create routes with checkpoints and quizzes, with AI help. Answer → Clue → Knowledge card → Discovery."
    >
      {error && (
        <Alert variant="error" className="mb-4">
          {error instanceof Error ? error.message : 'Failed to load routes'}
        </Alert>
      )}

      {isAdmin && (
        <Section title="" className="mb-4">
          {!showCreate ? (
            <button type="button" onClick={() => setShowCreate(true)} className={btnPrimary}>
              Create route
            </button>
          ) : (
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 max-w-2xl">
              <div className="flex flex-wrap gap-2 mb-4 border-b border-slate-200 pb-3">
                <button
                  type="button"
                  onClick={() => setCreateMode('ai')}
                  className={createMode === 'ai' ? btnPrimary : btnSecondary}
                >
                  AI-assisted
                </button>
                <button
                  type="button"
                  onClick={() => setCreateMode('manual')}
                  className={createMode === 'manual' ? btnPrimary : btnSecondary}
                >
                  Manual
                </button>
                <button
                  type="button"
                  onClick={() => setCreateMode('batch')}
                  className={createMode === 'batch' ? btnPrimary : btnSecondary}
                >
                  Import JSON
                </button>
              </div>

              {createMode === 'batch' ? (
                <>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Route name (optional; used only when JSON has no "name"/"title")</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Athens Old Town (or leave empty)"
                    className={inputClass + ' mb-3'}
                  />
                  <label className="block text-sm font-medium text-slate-700 mb-1">Paste route JSON (one object or an array of route objects)</label>
                  <textarea
                    value={batchJson}
                    onChange={(e) => { setBatchJson(e.target.value); setBatchParseError(null) }}
                    placeholder={'{\n  "type": "history",\n  "city": "Athens",\n  "radiusMeters": 1200,\n  "estimatedDurationMin": 45,\n  "difficulty": "medium",\n  "checkpoints": [\n    { "order": 1, "coordinates": { "lat": 37.9755, "lng": 23.7348 }, "validationRadiusMeters": 30, "quiz": { "question": "...", "options": ["A", "B", "C", "D"], "correctAnswerIndex": 1 } }\n  ]\n}'}
                    className={inputClass + ' mb-2 font-mono text-xs'}
                    rows={14}
                  />
                  {batchParseError && <p className="text-sm text-red-600 mb-2">{batchParseError}</p>}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleImportBatch}
                      disabled={!batchJson.trim() || createFromBatch.isPending || batchImporting}
                      className={btnPrimary}
                    >
                      {createFromBatch.isPending || batchImporting ? 'Importing…' : 'Import and create route(s)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowCreate(false); setBatchJson(''); setBatchParseError(null); setNewName('') }}
                      className={btnSecondary}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Route name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Athens Old Town"
                    className={inputClass + ' mb-3'}
                  />
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
                  <textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Short description of the route"
                    className={inputClass + ' mb-3'}
                    rows={2}
                  />
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                      <select
                        value={newType}
                        onChange={(e) => setNewType(e.target.value as RouteContentType)}
                        className={inputClass}
                      >
                        <option value="history">📜 History</option>
                        <option value="literature">📖 Literature</option>
                        <option value="culture">🏛 Culture</option>
                        <option value="architecture">⛪ Architecture</option>
                        <option value="sports">⚽ Sports</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Difficulty</label>
                      <select
                        value={newDifficulty}
                        onChange={(e) => setNewDifficulty(e.target.value as RouteDifficulty)}
                        className={inputClass}
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                    <input
                      type="text"
                      value={newCity}
                      onChange={(e) => setNewCity(e.target.value)}
                      placeholder="e.g. Athens"
                      className={inputClass}
                    />
                  </div>
                  {createMode === 'ai' && (
                    <>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <button
                          type="button"
                          onClick={handleDesignWithAi}
                          disabled={!newName.trim() || designSuggest.isPending || !user || !isAdmin}
                          title={!user ? 'Log in to use Design with AI' : !isAdmin ? 'Admin only' : undefined}
                          className="px-3 py-1.5 rounded text-sm font-medium border border-emerald-600 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                        >
                          {designSuggest.isPending ? 'Asking AI…' : 'Get AI suggestion'}
                        </button>
                      </div>
                      {(designSuggest.isError && (designSuggestAuthError || designSuggest.error?.message)) && (
                        <p className="mt-1 text-sm text-red-600 mb-2">{designSuggestAuthError ?? designSuggest.error?.message ?? 'AI suggestion failed'}</p>
                      )}
                      {aiSuggestions && aiSuggestions.length > 0 && (
                        <div className="mb-3 p-3 bg-white rounded border border-slate-200">
                          <p className="text-sm font-medium text-slate-700 mb-2">Review suggestions (edit in editor after create)</p>
                          <button type="button" onClick={handleConfirmCreateFromDesign} disabled={createFromDesign.isPending} className={btnPrimary + ' mr-2'}>
                            {createFromDesign.isPending ? 'Creating…' : 'Create route with these'}
                          </button>
                          <button type="button" onClick={() => setAiSuggestions(null)} className={btnSecondary}>Clear</button>
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {createMode === 'manual' && (
                      <button
                        type="button"
                        onClick={handleCreate}
                        disabled={!newName.trim() || createRoute.isPending}
                        className={btnPrimary}
                      >
                        {createRoute.isPending ? 'Creating…' : 'Create and edit'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { setShowCreate(false); setNewName(''); setNewDescription(''); setNewCity(''); setAiSuggestions(null) }}
                      className={btnSecondary}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </Section>
      )}

      {isLoading && <LoadingMessage>Loading routes…</LoadingMessage>}

      {!isLoading && (
        <Section title="Routes">
          {routes.length === 0 ? (
            <p className="text-slate-500 text-sm py-6 text-center md:py-8">
              No routes yet. {isAdmin ? 'Create one above (or use Design with AI).' : ''}
            </p>
          ) : (
            <>
              {/* Mobile: cards (quiz-route style) */}
              <ul className="md:hidden list-none p-0 m-0 space-y-4">
                {routes.map((r: ExplorationRoute) => (
                  <li key={r.id} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-base font-semibold text-slate-800 m-0 leading-tight">
                          {r.name}
                        </h3>
                        <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {r.type ?? 'history'}
                        </span>
                      </div>
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm m-0">
                        <dt className="text-slate-500">City</dt>
                        <dd className="text-slate-800 font-medium">{r.city ?? '—'}</dd>
                        <dt className="text-slate-500">Difficulty</dt>
                        <dd className="text-slate-800">{r.difficulty ?? '—'}</dd>
                        <dt className="text-slate-500">Total XP</dt>
                        <dd className="text-slate-800 font-medium">{r.totalXp ?? 0}</dd>
                        {(r.estimated_duration_min != null && r.estimated_duration_min > 0) && (
                          <>
                            <dt className="text-slate-500">Duration</dt>
                            <dd className="text-slate-800">~{r.estimated_duration_min} min</dd>
                          </>
                        )}
                        {(r.radius_meters != null && r.radius_meters > 0) && (
                          <>
                            <dt className="text-slate-500">Radius</dt>
                            <dd className="text-slate-800">{r.radius_meters} m</dd>
                          </>
                        )}
                      </dl>
                      {r.description && (
                        <p className="text-sm text-slate-600 mt-2 mb-3 line-clamp-2">{r.description}</p>
                      )}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                        <span className="text-xs text-slate-500">{r.is_public ? 'Public' : 'Private'}</span>
                        {isAdmin && (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => navigate(PathConstants.explorationRouteEdit(r.id))}
                              className={btnSecondary}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(r.id)}
                              className={btnDanger}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Tablet/Desktop: table */}
              <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-3 text-left font-semibold text-slate-600">Name</th>
                      <th className="p-3 text-left font-semibold text-slate-600">Type</th>
                      <th className="p-3 text-left font-semibold text-slate-600">Difficulty</th>
                      <th className="p-3 text-left font-semibold text-slate-600">City</th>
                      <th className="p-3 text-left font-semibold text-slate-600">Total XP</th>
                      <th className="p-3 text-left font-semibold text-slate-600">Duration</th>
                      <th className="p-3 text-left font-semibold text-slate-600">Description</th>
                      <th className="p-3 text-left font-semibold text-slate-600">Public</th>
                      {isAdmin && (
                        <th className="p-3 text-left font-semibold text-slate-600 w-40">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {routes.map((r: ExplorationRoute) => (
                      <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-3 font-medium">{r.name}</td>
                        <td className="p-3 text-slate-600">{r.type ?? '—'}</td>
                        <td className="p-3 text-slate-600">{r.difficulty ?? '—'}</td>
                        <td className="p-3 text-slate-600">{r.city ?? '—'}</td>
                        <td className="p-3 font-medium text-slate-800">{r.totalXp ?? 0}</td>
                        <td className="p-3 text-slate-600">{r.estimated_duration_min != null ? `~${r.estimated_duration_min} min` : '—'}</td>
                        <td className="p-3 text-slate-600 max-w-[200px] truncate" title={r.description || undefined}>{r.description || '—'}</td>
                        <td className="p-3">{r.is_public ? 'Yes' : 'No'}</td>
                        {isAdmin && (
                          <td className="p-3">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => navigate(PathConstants.explorationRouteEdit(r.id))}
                                className={btnSecondary}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(r.id)}
                                className={btnDanger}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Section>
      )}

      {aiSuggestions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-4 max-w-lg w-full max-h-[85vh] flex flex-col">
            <h3 className="text-lg font-semibold m-0 mb-2">AI-designed checkpoints</h3>
            <p className="text-slate-600 text-sm m-0 mb-3">
              Review the suggested checkpoints. Places will be geocoded when you create the route. You can adjust pins in the editor after.
            </p>
            <div className="overflow-y-auto flex-1 min-h-0 border border-slate-200 rounded p-3 mb-4 space-y-3">
              {aiSuggestions.map((c, i) => (
                <div key={i} className="text-sm p-2 rounded bg-slate-50 border border-slate-100">
                  <span className="font-medium text-slate-700">#{c.sequenceOrder + 1}</span>
                  {c.placeName && <span className="text-slate-500 ml-2">({c.placeName})</span>}
                  <p className="m-0 mt-1 text-slate-700">{c.clueText}</p>
                  {c.knowledgeCard?.title && (
                    <p className="m-0 mt-0.5 text-slate-600 italic">{c.knowledgeCard.title}</p>
                  )}
                  <span className="text-xs text-slate-500">{c.xpAwarded} XP</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAiSuggestions(null)}
                className={btnSecondary}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCreateFromDesign}
                disabled={createFromDesign.isPending}
                className={btnPrimary}
              >
                {createFromDesign.isPending ? 'Creating…' : 'Create route with these'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-4 max-w-sm w-full">
            <h3 className="text-lg font-semibold m-0 mb-2">Delete route?</h3>
            <p className="text-slate-600 text-sm m-0 mb-4">
              This will delete the route and all its checkpoints. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteConfirmId(null)} className={btnSecondary}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteRoute.isPending}
                className={btnDanger}
              >
                {deleteRoute.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}
