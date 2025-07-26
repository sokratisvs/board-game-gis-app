import { useContext, useEffect } from 'react';
import { LocationContext } from '../../context/Location.context';
import { AuthContext } from '../../context/Auth.context';

function UpdateLocationComponent() {
    const { user, setUserLocation } = useContext(AuthContext);
    const { location, getLocation, getSavedLocation, saveLocation, updateLocation } = useContext(LocationContext);
    // update location every time the component mounts
    useEffect(() => {
        getLocation();
    }, [user]);

    const handleLocationUpdate = async () => {
        if (location) {
            setUserLocation(location);
            const locationResponse: any = await getSavedLocation(user.userId);
            console.log('Saved location:', locationResponse);
            const savedLocation = locationResponse?.data?.[0]?.coordinates;
            savedLocation ? await updateLocation(user.userId, location) : await saveLocation(user.userId, location);
        }
    };

    return (
        <div>
            <button onClick={handleLocationUpdate}>Update Location</button>
        </div>
    );
}

export default UpdateLocationComponent;
