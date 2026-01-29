import { useContext, useEffect } from 'react'
import { LocationContext } from '../../context/Location.context'
import { AuthContext } from '../../context/Auth.context'

function UpdateLocationComponent() {
  const { user, setUserLocation } = useContext(AuthContext)
  const {
    location,
    getLocation,
    getSavedLocation,
    saveLocation,
    updateLocation,
  } = useContext(LocationContext)

  useEffect(() => {
    getLocation()
  }, [user, getLocation])

  const handleLocationUpdate = async () => {
    if (location) {
      setUserLocation(location)
      const locationResponse: any = await getSavedLocation(user.userId)
      const savedLocation = locationResponse?.data?.[0]?.coordinates
      savedLocation
        ? await updateLocation(user.userId, location)
        : await saveLocation(user.userId, location)
    }
  }

  return (
    <button
      type="button"
      onClick={handleLocationUpdate}
      className="
        inline-flex items-center justify-center px-4 py-2
        text-sm font-medium rounded-lg
        bg-sky-500 text-white border border-sky-600
        hover:bg-sky-600
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500
        transition-colors
      "
    >
      Update Location
    </button>
  )
}

export default UpdateLocationComponent
