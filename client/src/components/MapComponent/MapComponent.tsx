import { Icon } from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './MapComponent.css';

export default function MapComponent() {
//   const mapRef = useRef();
//   const [bounds, setbounds] = useState([
//     [-90, -180],
//     [90, 180],
//   ]);
  const position = [51.505, -0.09]
  const markers = [
    {
        location: {
            latitude: 40.51906594602173, 
            longitude: 21.679130381253447
        },
        popup: 'Serena Rodriguez'
    },
    {
        location: {
            latitude: 40.50548855025817, 
            longitude: 21.672340660174335
        },
        popup: 'Maya Patel'
    },
    {
        location: {
            latitude: 40.51114361383287, 
            longitude:21.66786604790538
        },
        popup: 'Isaac Ramirez'
    }
  ]
 
  const myIcon = new Icon({
    className: 'marker',
    // iconUrl: 'https://cdn-icons-png.flaticon.com/512/5616/5616461.png',
    iconUrl: require('../../assets/icons/marker-icon.png'),
    iconSize: [38, 38]
   })


  return (
    <MapContainer 
        center={[40.51158785749875, 21.6792781663114]}
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
            {markers.map(marker => (
                <Marker 
                    position={[marker.location.latitude,  marker.location.longitude]} 
                    icon={myIcon}>
                      <Popup>
                        {marker?.popup}
                      </Popup>
            </Marker>
            ))
            }
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
