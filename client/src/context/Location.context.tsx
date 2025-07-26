import { createContext, useContext, useState, ReactNode } from 'react';

interface LocationContextType {
    location: { lat: number; lng: number } | null;
    loading: boolean;
    error: string | null;
    getLocation: () => void;
    getSavedLocation: (userId: string) => Promise<void>;
    saveLocation: (userId: string, coordinates: { lat: number; lng: number }) => Promise<void>;
    updateLocation: (userId: string, coordinates: { lat: number; lng: number }) => Promise<void>;
}

export const LocationContext = createContext<LocationContextType>({
    location: null,
    loading: false,
    error: null,
    getLocation: () => { },
    getSavedLocation: async () => { },
    saveLocation: async () => { },
    updateLocation: async () => { },
});

export const useLocation = () => {
    return useContext(LocationContext);
};



interface LocationProviderProps {
    children: ReactNode;
}

export const LocationProvider = ({ children }: LocationProviderProps) => {
    interface Coordinates {
        lat: number;
        lng: number;
    }

    const [location, setLocation] = useState<Coordinates | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getLocation = () => {
        if (!navigator.geolocation) {
            setError('Geolocation is not supported');
            return;
        }

        setLoading(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setLocation({ lat: latitude, lng: longitude });
                setLoading(false);
            },
            (err) => {
                setError(err.message);
                setLoading(false);
            }
        );
    };

    const getSavedLocation = async (userId: string) => {
        try {
            const response = await fetch(`http://localhost:5000/location/${userId}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                // body: JSON.stringify({ userId, coordinates }),
            });
            const data = await response.json();
            // setLocation(coordinates);
            console.log('Saved location retrieved:', data);
        } catch (error) {
            console.error('Error retrieving saved location:', error);
        }
    };

    const saveLocation = async (userId: string, coordinates: { lat: number, lng: number }) => {
        try {
            const response = await fetch('http://localhost:5000/location', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, coordinates }),
            });
            const data = await response.json();
            setLocation(coordinates);
            console.log('Location saved:', data);
        } catch (error) {
            console.error('Error saving location:', error);
        }
    };

    const updateLocation = async (userId: string, coordinates: { lat: number, lng: number }) => {
        try {
            const response = await fetch(`http://localhost:5000/location/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ coordinates }),
            });
            const data = await response.json();
            setLocation(coordinates);
            console.log('Location updated:', data);
        } catch (error) {
            console.error('Error updating location:', error);
        }
    };

    const value = {
        location,
        loading,
        error,
        getLocation,
        getSavedLocation,
        saveLocation,
        updateLocation,
    };

    return (
        <LocationContext.Provider value={value}>
            {children}
        </LocationContext.Provider>
    );
};
