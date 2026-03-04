import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query'
import api from '../api/axios'

export type MatchType = 'tournament' | 'casual' | 'campaign' | 'other'
export type MatchesOverviewStats = {
  live: number
  upcoming: number
  total: number
}

export type MatchListItem = {
  matchId: string
  zoneName: string
  zonePosition: { lat: number; lng: number } | null
  matchType: string
  startTime?: string | null
  endTime?: string | null
  gameName?: string | null
  playerCount: number
  created_at: string
}

export type MatchPlayer = {
  id: string
  displayName: string
  healthPercent: number
  manaCurrent: number
  manaMax: number
  order: number
  isCurrentTurn?: boolean
}

export type MatchDetail = {
  matchId: string
  zoneName: string
  matchType: string
  startTime?: string | null
  endTime?: string | null
  gameName?: string | null
  zonePosition?: { lat: number; lng: number }
  currentPlayer: MatchPlayer
  players: MatchPlayer[]
  currentTurnPlayerId: string | null
  unreadChatCount: number
  lastDiceValues: number[]
  gridSize?: { rows: number; cols: number }
  highlightedCell?: { row: number; col: number } | null
}

export type MatchesListParams = {
  lat?: number
  lng?: number
  radius?: number
  type?: string
  dateFrom?: string
  dateTo?: string
} | null
type MatchesStatsParams = {
  type?: string
} | null

async function fetchMatchesList(params: NonNullable<MatchesListParams>): Promise<MatchListItem[]> {
  const search = new URLSearchParams()
  if (params.lat != null && !Number.isNaN(params.lat)) search.set('lat', String(params.lat))
  if (params.lng != null && !Number.isNaN(params.lng)) search.set('lng', String(params.lng))
  if (params.radius != null) search.set('radius', String(params.radius))
  if (params.type) search.set('type', params.type)
  if (params.dateFrom) search.set('dateFrom', params.dateFrom)
  if (params.dateTo) search.set('dateTo', params.dateTo)
  const { data } = await api.get<MatchListItem[]>(`/matches?${search}`)
  return Array.isArray(data) ? data : []
}

async function fetchMatchDetail(matchId: string): Promise<MatchDetail> {
  const { data } = await api.get<MatchDetail>(`/matches/${matchId}`)
  return data
}

async function createMatch(payload: {
  zoneName: string
  zonePosition?: { lat: number; lng: number }
  matchType?: string
  startTime?: string | null
  endTime?: string | null
  gameName?: string | null
}): Promise<MatchDetail> {
  const { data } = await api.post<MatchDetail>('/matches', payload)
  return data
}

export type UpdateMatchPayload = {
  zoneName?: string
  zonePosition?: { lat: number; lng: number } | null
  matchType?: string
  startTime?: string | null
  endTime?: string | null
  gameName?: string | null
}

async function updateMatch(
  matchId: string,
  payload: UpdateMatchPayload
): Promise<MatchDetail> {
  const { data } = await api.patch<MatchDetail>(`/matches/${matchId}`, payload)
  return data
}

async function deleteMatch(matchId: string): Promise<void> {
  await api.delete(`/matches/${matchId}`)
}

async function fetchMatchesStats(
  params: NonNullable<MatchesStatsParams>
): Promise<MatchesOverviewStats> {
  const search = new URLSearchParams()
  if (params.type) search.set('type', params.type)
  const url = search.toString() ? `/matches/stats?${search}` : '/matches/stats'
  const { data } = await api.get<MatchesOverviewStats>(url)
  return {
    live: Number(data?.live ?? 0),
    upcoming: Number(data?.upcoming ?? 0),
    total: Number(data?.total ?? 0),
  }
}

export const matchesKeys = {
  all: ['matches'] as const,
  list: (params: MatchesListParams) => [...matchesKeys.all, 'list', params] as const,
  detail: (matchId: string) => [...matchesKeys.all, 'detail', matchId] as const,
  stats: (params: MatchesStatsParams) => [...matchesKeys.all, 'stats', params] as const,
}

export function useMatchesList(
  params: MatchesListParams,
  options?: Omit<UseQueryOptions<MatchListItem[]>, 'queryKey' | 'queryFn' | 'enabled'>
) {
  const hasGeo =
    params != null &&
    params.lat != null &&
    params.lng != null &&
    !Number.isNaN(params.lat) &&
    !Number.isNaN(params.lng)
  const enabled = params != null && (hasGeo || params.lat == null)

  return useQuery({
    queryKey: matchesKeys.list(params),
    queryFn: () => fetchMatchesList(params!),
    enabled,
    ...options,
  })
}

export function useMatchDetail(
  matchId: string | null,
  options?: Omit<UseQueryOptions<MatchDetail>, 'queryKey' | 'queryFn' | 'enabled'>
) {
  return useQuery({
    queryKey: matchesKeys.detail(matchId ?? ''),
    queryFn: () => fetchMatchDetail(matchId!),
    enabled: !!matchId,
    ...options,
  })
}

export function useMatchesStats(
  params: MatchesStatsParams,
  options?: Omit<UseQueryOptions<MatchesOverviewStats>, 'queryKey' | 'queryFn' | 'enabled'>
) {
  return useQuery({
    queryKey: matchesKeys.stats(params),
    queryFn: () => fetchMatchesStats(params || {}),
    enabled: params != null,
    ...options,
  })
}

export function useCreateMatch(
  options?: UseMutationOptions<
    MatchDetail,
    Error,
    {
      zoneName: string
      zonePosition?: { lat: number; lng: number }
      matchType?: string
      startTime?: string | null
      endTime?: string | null
      gameName?: string | null
    }
  >
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createMatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: matchesKeys.all })
    },
    ...options,
  })
}

export function useUpdateMatch(
  options?: UseMutationOptions<MatchDetail, Error, { matchId: string } & UpdateMatchPayload>
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ matchId, ...payload }: { matchId: string } & UpdateMatchPayload) =>
      updateMatch(matchId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: matchesKeys.all })
    },
    ...options,
  })
}

export function useDeleteMatch(
  options?: UseMutationOptions<void, Error, string>
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteMatch,
    onSuccess: (_data, matchId) => {
      // Optimistically remove the deleted match from any cached lists
      queryClient.setQueriesData<MatchListItem[] | undefined>(
        { queryKey: matchesKeys.all, exact: false },
        (old) =>
          Array.isArray(old)
            ? old.filter((m) => m.matchId !== matchId)
            : old
      )
      queryClient.invalidateQueries({ queryKey: matchesKeys.all })
    },
    ...options,
  })
}
