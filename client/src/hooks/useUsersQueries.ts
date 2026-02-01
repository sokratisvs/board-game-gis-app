import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query'
import api from '../api/axios'

// --- Types (aligned with backend) ---

export type User = {
  user_id: number
  username: string
  email: string
  created_on: string
  last_login: string
  type: string
  active: boolean
  is_online?: boolean
}

export type Pagination = {
  currentPage: number
  totalPages: number
  totalRecords: number
  limit: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export type UsersListResponse = {
  users: User[]
  pagination: Pagination
}

export type UserStats = {
  user: number
  shop: number
  event: number
  admin: number
}

export type UserConfig = {
  user_id: number
  games_owned: string[]
  games_liked: string[]
  game_types_interested: string[]
  has_space: boolean
  city: string | null
  subscription: 'free' | 'extra'
  updated_at: string | null
}

// --- Query keys ---

export const usersKeys = {
  all: ['users'] as const,
  lists: () => [...usersKeys.all, 'list'] as const,
  list: (
    page: number,
    limit: number,
    types?: string[],
    username?: string,
    active?: boolean
  ) =>
    [
      ...usersKeys.lists(),
      page,
      limit,
      ...(types ?? []).sort(),
      username ?? '',
      active ?? null,
    ] as const,
  stats: () => [...usersKeys.all, 'stats'] as const,
  config: (userId: number) => [...usersKeys.all, userId, 'config'] as const,
  nearby: (lat: number, lng: number, radius: number) =>
    [...usersKeys.all, 'nearby', lat, lng, radius] as const,
}

// --- Fetchers ---

async function fetchUsersList(params: {
  page: number
  limit: number
  types?: string[]
  username?: string
  active?: boolean
}): Promise<UsersListResponse> {
  const search = new URLSearchParams()
  search.set('page', String(params.page))
  search.set('limit', String(params.limit))
  if (params.types && params.types.length > 0) {
    search.set('type', params.types.join(','))
  }
  if (params.username && params.username.trim()) {
    search.set('username', params.username.trim())
  }
  if (params.active !== undefined && params.active !== null) {
    search.set('active', String(params.active))
  }
  const { data } = await api.get<UsersListResponse>(`/users?${search}`)
  return data
}

async function fetchUserStats(): Promise<UserStats> {
  const { data } = await api.get<UserStats>('/users/stats')
  return data
}

async function fetchUserConfig(userId: number): Promise<UserConfig> {
  const { data } = await api.get<UserConfig>(`/users/${userId}/config`)
  return data
}

// Backend returns lat, lng; frontend expects latitude, longitude
export type NearbyUserRow = User & {
  lat: number
  lng: number
  distance: number
}

export type NearbyUser = User & {
  latitude: number
  longitude: number
  distance: number
}

async function fetchNearbyUsers(params: {
  lat: number
  lng: number
  radius: number
}): Promise<NearbyUser[]> {
  const { data } = await api.get<NearbyUserRow[]>('/users/nearby', {
    params: {
      latitude: params.lat,
      longitude: params.lng,
      radius: params.radius,
    },
  })
  return (data || []).map((row) => ({
    ...row,
    latitude: row.lat,
    longitude: row.lng,
  }))
}

// --- Hooks ---

type UseUsersListParams = {
  page: number
  limit: number
  types?: string[]
  username?: string
  active?: boolean
  enabled?: boolean
}

export function useUsersList(
  { page, limit, types, username, active, enabled = true }: UseUsersListParams,
  options?: Omit<
    UseQueryOptions<UsersListResponse>,
    'queryKey' | 'queryFn' | 'enabled'
  >
) {
  const typesKey = types && types.length > 0 ? [...types].sort() : undefined
  const usernameKey = username?.trim() ?? ''
  const activeKey = active === undefined || active === null ? null : active
  return useQuery({
    queryKey: usersKeys.list(page, limit, typesKey, usernameKey, activeKey),
    queryFn: () => fetchUsersList({ page, limit, types, username, active }),
    enabled,
    ...options,
  })
}

export function useUserStats(
  enabled = true,
  options?: Omit<UseQueryOptions<UserStats>, 'queryKey' | 'queryFn' | 'enabled'>
) {
  return useQuery({
    queryKey: usersKeys.stats(),
    queryFn: fetchUserStats,
    enabled,
    ...options,
  })
}

export function useUserConfig(
  userId: number | null | undefined,
  options?: Omit<
    UseQueryOptions<UserConfig>,
    'queryKey' | 'queryFn' | 'enabled'
  >
) {
  return useQuery({
    queryKey: usersKeys.config(userId ?? 0),
    queryFn: () => fetchUserConfig(userId!),
    enabled: typeof userId === 'number' && userId > 0,
    ...options,
  })
}

export function useNearbyUsers(
  params: { lat: number; lng: number; radius: number } | null,
  options?: Omit<
    UseQueryOptions<NearbyUser[]>,
    'queryKey' | 'queryFn' | 'enabled'
  >
) {
  return useQuery({
    queryKey:
      params != null
        ? usersKeys.nearby(params.lat, params.lng, params.radius)
        : ['users', 'nearby', 'disabled'],
    queryFn: () => fetchNearbyUsers(params!),
    enabled: params != null && params.radius > 0,
    ...options,
  })
}

// --- Mutations ---

export function useToggleUserActive(
  options?: UseMutationOptions<
    { user: User },
    Error,
    { userId: number; currentActive: boolean }
  >
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      userId,
      currentActive,
    }: {
      userId: number
      currentActive: boolean
    }) => {
      const { data } = await api.put<{ user: User }>(`/user/${userId}`, {
        active: !currentActive,
      })
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() })
      queryClient.invalidateQueries({ queryKey: usersKeys.all })
    },
    ...options,
  })
}

type SaveConfigPayload = Omit<UserConfig, 'user_id' | 'updated_at'>

export function useSaveUserConfig(
  options?: UseMutationOptions<
    void,
    Error,
    { userId: number; config: SaveConfigPayload }
  >
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      userId,
      config,
    }: {
      userId: number
      config: SaveConfigPayload
    }) => {
      await api.put(`/users/${userId}/config`, {
        games_owned: config.games_owned,
        games_liked: config.games_liked,
        game_types_interested: config.game_types_interested,
        has_space: config.has_space,
        city: config.city ?? null,
        subscription: config.subscription,
      })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: usersKeys.config(variables.userId),
      })
    },
    ...options,
  })
}
