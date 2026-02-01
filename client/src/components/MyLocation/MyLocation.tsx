import L, { LatLngExpression } from 'leaflet'
import { useContext, useEffect, useState, useRef } from 'react'
import { Popup, useMap } from 'react-leaflet'
import { useUsers } from '../../context/Users.context'
import LocationMarker from '../LocationMarker/LocationMarker'
import { LocationContext } from '../../context/Location.context'
import { AuthContext } from '../../context/Auth.context'

export default function MyLocation() {
  const { user } = useContext(AuthContext)
  const [myCoordinates, setMyCoordinates] = useState<LatLngExpression>([0, 0])
  const { saveLocation } = useContext(LocationContext)
  const { fetchUsersNearby } = useUsers()
  const map = useMap()

  // Use refs to store latest values for use in event handler
  const saveLocationRef = useRef(saveLocation)
  const fetchUsersNearbyRef = useRef(fetchUsersNearby)
  const userIdRef = useRef(user?.userId)

  // Update refs when values change
  useEffect(() => {
    saveLocationRef.current = saveLocation
    fetchUsersNearbyRef.current = fetchUsersNearby
    userIdRef.current = user?.userId
  }, [saveLocation, fetchUsersNearby, user?.userId])

  useEffect(() => {
    if (!map || !userIdRef.current) return

    map.locate().on('locationfound', function (e) {
      setMyCoordinates(e.latlng)
      map.flyTo(e.latlng, map.getZoom())
      const accuracyRadius = e.accuracy
      const circle = L.circle(e.latlng, accuracyRadius)
      circle.addTo(map)
      const userId = userIdRef.current
      if (userId) saveLocationRef.current(userId, e.latlng)
      fetchUsersNearbyRef.current(e.latlng, accuracyRadius)
    })
  }, [map])

  return (
    myCoordinates && (
      <LocationMarker
        position={myCoordinates}
        type="myLocation"
        name="My location"
      >
        {/* <Marker 
            position={myCoordinates} 
            icon={myIcon}> */}
        <Popup>
          You are here.
          {/*    Map bbox: <br />
               <b>Southwest lng</b>: {bbox[0]} <br />
                <b>Southwest lat</b>: {bbox[1]} <br />
                <b>Northeast lng</b>: {bbox[2]} <br />
               <b>Northeast lat</b>: {bbox[3]}  */}
        </Popup>
        {/* </Marker> */}
      </LocationMarker>
    )
  )
}
