import { MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import LocationMarker from '../LocationMarker/LocationMarker'
import MyLocation from '../MyLocation/MyLocation'
import { useUsers } from '../../context/Users.context'
import './MapComponent.css'

export default function MapComponent() {
  const { nearbyUsers } = useUsers()

  return (
    <MapContainer
      center={[40.51906594602173, 21.679130381253447]}
      zoom={15}
      maxZoom={19}
      minZoom={2}
      bounceAtZoomLimits={true}
      maxBoundsViscosity={0.95}
      scrollWheelZoom={false}
    >
      <TileLayer
        noWrap={false}
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {nearbyUsers.map((user) => (
        <LocationMarker
          key={`user-${user.user_id}`}
          position={[user.latitude, user.longitude]}
          type={user.type}
          name={user.username}
        />
      ))}
      <MyLocation />
      {/* <LayersControl position="topright">
          <LayersControl.BaseLayer name="OpenStreet">
            <TileLayer
              noWrap={false}
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {
                markers.map(marker => (
                    <Marker 
                    position={[51.505, -0.09]} 
                    icon={myIcon}>
                    {/* <Popup>
                        Location :
                    </Popup>
                </Marker>
                ))
            }
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              noWrap={false}
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}.png"
            />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer checked name="Dark">
            <TileLayer
              noWrap={false}
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
        </LayersControl.BaseLayer>
        </LayersControl>  */}
    </MapContainer>
  )
}
