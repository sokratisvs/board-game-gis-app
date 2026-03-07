import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query'
import api from '../api/axios'

export type RouteDifficulty = 'easy' | 'medium' | 'hard'
/** Route content type for map symbols and filtering (urban exploration). */
export type RouteContentType = 'history' | 'literature' | 'culture' | 'architecture' | 'sports'

export const ROUTE_TYPES: RouteContentType[] = ['history', 'literature', 'culture', 'architecture', 'sports']

export type ExplorationRoute = {
  id: string
  name: string
  description: string | null
  created_by: number | null
  is_public: boolean
  created_at: string
  updated_at: string
  difficulty?: RouteDifficulty
  /** Content type: history, literature, culture, architecture, sports (affects map icon). */
  type?: RouteContentType
  city?: string | null
  world?: string | null
  estimated_duration_min?: number | null
  radius_meters?: number | null
  is_active?: boolean
  title?: string
  /** Route cover image URL (from routes.image_url or first checkpoint image). */
  imageUrl?: string | null
  /** First checkpoint position for map display (when route has checkpoints). */
  firstCheckpointLat?: number
  firstCheckpointLng?: number
  /** Sum of checkpoint xp_awarded; total XP earned by mobile user for completing the route. */
  totalXp?: number
  /** Route-level recommendations (for mobile). */
  recommendations?: Recommendation[]
  /** Included when requesting with includeCheckpoints (for map pins). */
  checkpoints?: RouteCheckpoint[]
}

export type CheckpointQuiz = {
  question: string
  options: string[]
  correctAnswerIndex: number
}

export type RouteCheckpoint = {
  id: string
  routeId: string
  sequenceOrder: number
  lat: number
  lng: number
  clueText: string
  imageUrl: string | null
  knowledgeCard: { title?: string; description?: string; funFact?: string } | null
  xpAwarded: number
  nearbyRecommendations?: Array<{ type: string; id: string }>
  quiz?: CheckpointQuiz
  createdAt: string
}

export type RouteWithCheckpoints = ExplorationRoute & { checkpoints: RouteCheckpoint[] }

export type Recommendation = {
  id: string
  type: string
  name: string | null
  externalId: string | null
  lat: number | null
  lng: number | null
  description: string | null
  createdAt: string
}

export type PlayCheckpointResponse = {
  nextCheckpointId: string | null
  nextSequenceOrder: number | null
  clue: string
  imageUrl: string | null
  knowledgeCard: { title?: string; description?: string; funFact?: string } | null
  nearbyRecommendations: Array<{ type: string; id: string }>
  xpAwarded: number
}

export type DesignCheckpointSuggestion = {
  sequenceOrder: number
  clueText: string
  knowledgeCard: { title?: string; description?: string; funFact?: string } | null
  xpAwarded: number
  placeName: string
}

const keys = {
  all: ['exploration'] as const,
  routes: (type?: string) => [...keys.all, 'routes', type ?? 'all'] as const,
  route: (id: string) => [...keys.all, 'route', id] as const,
  checkpoints: (routeId: string) => [...keys.all, 'checkpoints', routeId] as const,
  recommendations: () => [...keys.all, 'recommendations'] as const,
  completedCheckpoints: (routeId?: string) => [...keys.all, 'completedCheckpoints', routeId ?? 'all'] as const,
}

export type RouteTypeFilter = RouteContentType | 'all'

async function fetchRoutes(params?: { type?: RouteTypeFilter; includeCheckpoints?: boolean }): Promise<(ExplorationRoute & { checkpoints?: RouteCheckpoint[] })[]> {
  const type = params?.type
  const includeCheckpoints = params?.includeCheckpoints
  const search = new URLSearchParams()
  if (type && type !== 'all') search.set('type', type)
  if (includeCheckpoints) search.set('includeCheckpoints', '1')
  const qs = search.toString()
  const url = qs ? `/exploration/routes?${qs}` : '/exploration/routes'
  const { data } = await api.get<(ExplorationRoute & { checkpoints?: RouteCheckpoint[] })[]>(url)
  return Array.isArray(data) ? data : []
}

async function fetchRoute(id: string): Promise<RouteWithCheckpoints> {
  const { data } = await api.get<RouteWithCheckpoints>(`/exploration/routes/${id}`)
  return data
}

async function fetchCheckpoints(routeId: string): Promise<RouteCheckpoint[]> {
  const { data } = await api.get<RouteCheckpoint[]>(`/exploration/routes/${routeId}/checkpoints`)
  return Array.isArray(data) ? data : []
}

async function fetchRecommendations(type?: string): Promise<Recommendation[]> {
  const url = type ? `/exploration/recommendations?type=${encodeURIComponent(type)}` : '/exploration/recommendations'
  const { data } = await api.get<Recommendation[]>(url)
  return Array.isArray(data) ? data : []
}

async function fetchCompletedCheckpoints(routeId?: string): Promise<string[]> {
  const url = routeId
    ? `/exploration/users/me/completed-checkpoints?routeId=${encodeURIComponent(routeId)}`
    : '/exploration/users/me/completed-checkpoints'
  const { data } = await api.get<{ completedCheckpointIds: string[] }>(url)
  return data?.completedCheckpointIds ?? []
}

export function useCompletedCheckpoints(routeId?: string | null) {
  return useQuery({
    queryKey: keys.completedCheckpoints(routeId ?? undefined),
    queryFn: () => fetchCompletedCheckpoints(routeId ?? undefined),
    enabled: true,
  })
}

export function useCompleteCheckpoint(routeId: string | null, checkpointId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await api.post(
        `/exploration/routes/${routeId}/checkpoints/${checkpointId}/complete`
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.completedCheckpoints() })
      if (routeId) qc.invalidateQueries({ queryKey: keys.completedCheckpoints(routeId) })
    },
  })
}

export type ScanCluePayload = { routeId: string; checkpointId: string; imageBase64: string }

export function useScanClue() {
  return useMutation({
    mutationFn: async ({
      routeId,
      checkpointId,
      imageBase64,
    }: ScanCluePayload): Promise<{ clue: string }> => {
      const { data } = await api.post<{ clue: string }>(
        `/exploration/routes/${routeId}/checkpoints/${checkpointId}/scan-clue`,
        { imageBase64 }
      )
      return data
    },
  })
}

export function useExplorationRoutes(
  params?: { type?: RouteTypeFilter; includeCheckpoints?: boolean } | Omit<UseQueryOptions<ExplorationRoute[]>, 'queryKey' | 'queryFn'>,
  options?: Omit<UseQueryOptions<ExplorationRoute[]>, 'queryKey' | 'queryFn'>
) {
  const type = params && typeof params === 'object' && 'type' in params ? params.type : undefined
  const includeCheckpoints = params && typeof params === 'object' && 'includeCheckpoints' in params ? params.includeCheckpoints : undefined
  const opts = (params && typeof params === 'object' && !('type' in params) && !('includeCheckpoints' in params) ? params : options) ?? {}
  const queryKey = [...keys.routes(type), includeCheckpoints ? 'checkpoints' : ''].filter(Boolean)
  return useQuery({
    queryKey,
    queryFn: () => fetchRoutes({ type, includeCheckpoints }),
    ...opts,
  })
}

export function useRouteDetail(
  routeId: string | null,
  options?: Omit<UseQueryOptions<RouteWithCheckpoints>, 'queryKey' | 'queryFn' | 'enabled'>
) {
  return useQuery({
    queryKey: keys.route(routeId ?? ''),
    queryFn: () => fetchRoute(routeId!),
    enabled: !!routeId,
    ...options,
  })
}

export function useRouteCheckpoints(
  routeId: string | null,
  options?: Omit<UseQueryOptions<RouteCheckpoint[]>, 'queryKey' | 'queryFn' | 'enabled'>
) {
  return useQuery({
    queryKey: keys.checkpoints(routeId ?? ''),
    queryFn: () => fetchCheckpoints(routeId!),
    enabled: !!routeId,
    ...options,
  })
}

export function useRecommendations(type?: string) {
  return useQuery({
    queryKey: [...keys.recommendations(), type ?? 'all'] as const,
    queryFn: () => fetchRecommendations(type),
  })
}

export function usePlayCheckpoint(routeId: string | null, order: number) {
  return useQuery({
    queryKey: [...keys.all, 'play', routeId, order] as const,
    queryFn: async (): Promise<PlayCheckpointResponse> => {
      const { data } = await api.get(`/exploration/routes/${routeId}/play/checkpoint/${order}`)
      return data
    },
    enabled: !!routeId && order >= 0,
  })
}

export function useDesignSuggest(
  options?: UseMutationOptions<
    { checkpoints: DesignCheckpointSuggestion[] },
    Error,
    { name: string; description?: string }
  >
) {
  return useMutation({
    mutationFn: async (body: { name: string; description?: string }) => {
      const { data } = await api.post<{ checkpoints: DesignCheckpointSuggestion[] }>(
        '/exploration/design-suggest',
        body
      )
      return data
    },
    ...options,
  })
}

export type CreateFromDesignPayload = {
  name: string
  description?: string
  is_public?: boolean
  difficulty?: RouteDifficulty
  type?: RouteContentType
  city?: string
  checkpoints: DesignCheckpointSuggestion[]
}

export function useCreateRouteFromDesign(
  options?: UseMutationOptions<RouteWithCheckpoints, Error, CreateFromDesignPayload>
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateFromDesignPayload) => {
      const { data } = await api.post<RouteWithCheckpoints>('/exploration/routes/from-design', body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...keys.all, 'routes'] }),
    ...options,
  })
}

/** Batch import: one object with route meta + checkpoints (paste JSON). */
export type BatchCheckpointInput = {
  order: number
  coordinates: { lat: number; lng: number }
  validationRadiusMeters?: number
  /** Optional image URL for this clue (e.g. photo of the place); user can also submit a photo at the place and it will be stored here with consent. */
  imageUrl?: string | null
  quiz: {
    question: string
    options: string[]
    correctAnswerIndex: number
  }
}

export type CreateFromBatchPayload = {
  name?: string
  title?: string
  description?: string
  /** Optional cover image URL for the route (parent image in route editor). */
  imageUrl?: string | null
  type?: RouteContentType
  city?: string
  radiusMeters?: number
  estimatedDurationMin?: number
  difficulty?: RouteDifficulty
  checkpoints: BatchCheckpointInput[]
}

export function useCreateRouteFromBatch(
  options?: UseMutationOptions<RouteWithCheckpoints, Error, CreateFromBatchPayload>
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateFromBatchPayload) => {
      const { data } = await api.post<RouteWithCheckpoints>('/exploration/routes/from-batch', body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...keys.all, 'routes'] }),
    ...options,
  })
}

export type CreateRoutePayload = {
  name: string
  description?: string
  is_public?: boolean
  difficulty?: RouteDifficulty
  type?: RouteContentType
  city?: string
  estimated_duration_min?: number
  radius_meters?: number
}

export function useCreateRoute(
  options?: UseMutationOptions<ExplorationRoute, Error, CreateRoutePayload>
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateRoutePayload) => {
      const { data } = await api.post<ExplorationRoute>('/exploration/routes', body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...keys.all, 'routes'] }),
    ...options,
  })
}

export type UpdateRoutePayload = {
  id: string
  name?: string
  description?: string
  is_public?: boolean
  difficulty?: RouteDifficulty
  type?: RouteContentType
  city?: string
  estimated_duration_min?: number
  radius_meters?: number
  is_active?: boolean
  /** Route cover image URL (parent image in route editor). */
  image_url?: string | null
  recommendationIds?: string[]
}

export function useUpdateRoute(
  options?: UseMutationOptions<ExplorationRoute, Error, UpdateRoutePayload>
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateRoutePayload) => {
      const { data } = await api.patch<ExplorationRoute>(`/exploration/routes/${id}`, body)
      return data
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: [...keys.all, 'routes'] })
      qc.invalidateQueries({ queryKey: keys.route(id) })
    },
    ...options,
  })
}

export function useDeleteRoute(options?: UseMutationOptions<void, Error, string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/exploration/routes/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...keys.all, 'routes'] }),
    ...options,
  })
}

export type CreateCheckpointPayload = {
  sequenceOrder: number
  lat: number
  lng: number
  clueText: string
  imageUrl?: string | null
  knowledgeCard?: { title?: string; description?: string; funFact?: string } | null
  xpAwarded?: number
  recommendationIds?: string[]
  quiz?: CheckpointQuiz
}

export function useCreateCheckpoint(
  routeId: string | null,
  options?: UseMutationOptions<RouteCheckpoint, Error, CreateCheckpointPayload>
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateCheckpointPayload) => {
      const { data } = await api.post<RouteCheckpoint>(`/exploration/routes/${routeId}/checkpoints`, body)
      return data
    },
    onSuccess: () => {
      if (routeId) {
        qc.invalidateQueries({ queryKey: keys.checkpoints(routeId) })
        qc.invalidateQueries({ queryKey: keys.route(routeId) })
        qc.invalidateQueries({ queryKey: [...keys.all, 'routes'] })
      }
    },
    ...options,
  })
}

export type UpdateCheckpointPayload = Partial<CreateCheckpointPayload>

export function useUpdateCheckpoint(routeId: string | null, checkpointId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: UpdateCheckpointPayload) => {
      const { data } = await api.patch<RouteCheckpoint>(
        `/exploration/routes/${routeId}/checkpoints/${checkpointId}`,
        body
      )
      return data
    },
    onSuccess: () => {
      if (routeId) {
        qc.invalidateQueries({ queryKey: keys.checkpoints(routeId) })
        qc.invalidateQueries({ queryKey: keys.route(routeId) })
        qc.invalidateQueries({ queryKey: [...keys.all, 'routes'] })
      }
    },
  })
}

export function useDeleteCheckpoint(routeId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (checkpointId: string) => {
      await api.delete(`/exploration/routes/${routeId}/checkpoints/${checkpointId}`)
    },
    onSuccess: () => {
      if (routeId) {
        qc.invalidateQueries({ queryKey: keys.checkpoints(routeId) })
        qc.invalidateQueries({ queryKey: keys.route(routeId) })
        qc.invalidateQueries({ queryKey: [...keys.all, 'routes'] })
      }
    },
  })
}

export type CreateRecommendationPayload = {
  type: string
  name?: string
  external_id?: string
  lat?: number
  lng?: number
  description?: string
}

export function useCreateRecommendation(
  options?: UseMutationOptions<Recommendation, Error, CreateRecommendationPayload>
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateRecommendationPayload) => {
      const { data } = await api.post<Recommendation>('/exploration/recommendations', body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.recommendations() }),
    ...options,
  })
}