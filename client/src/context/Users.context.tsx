import React, { createContext, useState, useContext, useCallback } from 'react'
import { useNearbyUsers, type NearbyUser } from '../hooks/useUsersQueries'

type NearbyCoords = { lat: number; lng: number } | null

type UsersContextType = {
  nearbyUsers: NearbyUser[]
  nearbyLoading: boolean
  nearbyError: string | null
  fetchUsersNearby: (
    coords: { lat: number; lng: number },
    radius: number
  ) => void
  clearNearbyUsers: () => void
}

const defaultContextValue: UsersContextType = {
  nearbyUsers: [],
  nearbyLoading: false,
  nearbyError: null,
  fetchUsersNearby: () => {},
  clearNearbyUsers: () => {},
}

const UsersContext = createContext<UsersContextType>(defaultContextValue)

type UsersContextProviderProps = {
  children: React.ReactNode
}

export const UsersContextProvider: React.FC<UsersContextProviderProps> = ({
  children,
}) => {
  const [coordsAndRadius, setCoordsAndRadius] = useState<{
    lat: number
    lng: number
    radius: number
  } | null>(null)

  const {
    data: nearbyUsers = [],
    isLoading: nearbyLoading,
    error: nearbyError,
  } = useNearbyUsers(coordsAndRadius)

  const fetchUsersNearby = useCallback(
    (coords: { lat: number; lng: number }, radius: number) => {
      setCoordsAndRadius({
        lat: coords.lat,
        lng: coords.lng,
        radius,
      })
    },
    []
  )

  const clearNearbyUsers = useCallback(() => {
    setCoordsAndRadius(null)
  }, [])

  const errorMessage =
    nearbyError instanceof Error
      ? nearbyError.message
      : 'Failed to load nearby users'

  return (
    <UsersContext.Provider
      value={{
        nearbyUsers,
        nearbyLoading,
        nearbyError: nearbyError ? errorMessage : null,
        fetchUsersNearby,
        clearNearbyUsers,
      }}
    >
      {children}
    </UsersContext.Provider>
  )
}

export const useUsers = () => {
  const context = useContext(UsersContext)
  if (!context) {
    throw new Error('useUsers must be used within a UsersContextProvider')
  }
  return context
}

export type { NearbyUser }
