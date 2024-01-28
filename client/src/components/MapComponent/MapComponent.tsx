import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import LocationMarker from '../LocationMarker/LocationMarker';
import MyLocation from '../MyLocation/MyLocation';
import './MapComponent.css';

export default function MapComponent() {

  const markers = [
    {
        coordinates: {
            lat: 37.942127583678776, 
            lng: 23.714480156086637
        },
        name: 'Serena Rodriguez',
        type: 'user'
    },
    {
      coordinates: {
            lat: 37.987086035192384, 
            lng: 23.726866021570746
        },
        name: 'Maya Patel',
        type: 'user'
    },
    {
      coordinates: {
            lat: 37.9335636650263, 
            lng: 23.755277420683132
        },
        name: 'Isaac Ramirez',
        type: 'user' // user, shop, event
    },
    {
      coordinates: {
            lat: 37.957637371954576,  
            lng: 23.72953503331404
        },
        name: 'Lambda Project',
        type: 'shop' // user, shop, event
    },
    {
      coordinates: {
            lat: 37.959311695128626,  
            lng: 23.706172718146803
        },
        name: '',
        type: '' // user, shop, event
    }
  ]

  return (
    <MapContainer
        center={[40.51906594602173, 21.679130381253447]}
        zoom={15}
        maxZoom={19}
        minZoom={2}
        bounceAtZoomLimits={true}
        maxBoundsViscosity={0.95}
        scrollWheelZoom={false}>
            <TileLayer
              noWrap={false}
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {markers.map((marker, index) => (
                <LocationMarker 
                key={index}
                position={[marker.coordinates.lat, marker.coordinates.lng]}
                type={marker.type}
                name={marker.name} />
            ))
            }
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
