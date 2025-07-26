import L, { LatLngExpression } from 'leaflet';
import { useContext, useEffect, useState } from 'react'
import { Popup, useMap } from 'react-leaflet';
import { useUsers } from '../../context/Users.context';
import LocationMarker from '../LocationMarker/LocationMarker';
import { LocationContext } from '../../context/Location.context';
import { AuthContext } from '../../context/Auth.context';

export default function MyLocation() {
    const { user } = useContext(AuthContext);
    const [myCoordinates, setMyCoordinates] = useState<LatLngExpression>([0, 0]);
    const { location, getLocation, saveLocation } = useContext(LocationContext);
    const { fetchUsersNearby } = useUsers();
    const [radius, setRadius] = useState(50000);
    // const [bbox, setBbox] = useState([]);

    const map = useMap();

    useEffect(() => {
        map.locate().on("locationfound", function (e) {
            setMyCoordinates(e.latlng)
            map.flyTo(e.latlng, map.getZoom());
            const radius = e.accuracy;
            const circle = L.circle(e.latlng, radius);
            circle.addTo(map);
            // setBbox(e?.bounds.toBBoxString().split(","));
            saveLocation(user.userId, e.latlng);
            fetchUsersNearby(e.latlng, radius);
        });
    }, []);

    return myCoordinates && (
        <LocationMarker position={myCoordinates} type="myLocation" name="My location">
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
    );
}