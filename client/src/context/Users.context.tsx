import React, { createContext, useState, useContext } from 'react';
import api from '../api/axios';

// Base user type (common fields)
type BaseUser = {
    user_id: number;
    username: string;
    email: string;
    created_on: string;
    last_login: string;
    type: string;
    active: boolean;
    is_online?: boolean;
};

// Regular user type (from /users endpoint)
type User = BaseUser;

// Nearby user type (from /users/nearby endpoint)
type NearbyUser = BaseUser & {
    latitude: number;
    longitude: number;
    distance: number;
};

// Pagination type
type Pagination = {
    currentPage: number;
    totalPages: number;
    totalRecords: number;
    limit: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
};

type UsersContextType = {
    // Regular users state
    users: User[];
    usersPagination: Pagination | null;
    usersLoading: boolean;
    usersError: string | null;

    // Nearby users state
    nearbyUsers: NearbyUser[];
    nearbyLoading: boolean;
    nearbyError: string | null;

    // Methods
    fetchUsers: (options?: {
        page?: number;
        limit?: number;
        active?: boolean;
        username?: string;
    }) => Promise<void>;
    fetchUsersNearby: (coords: { lat: number; lng: number }, radius: number) => Promise<void>;
    toggleUserActive: (userId: number) => Promise<void>;
    clearUsers: () => void;
    clearNearbyUsers: () => void;
};

// Default context value
const defaultContextValue: UsersContextType = {
    users: [],
    usersPagination: null,
    usersLoading: false,
    usersError: null,
    nearbyUsers: [],
    nearbyLoading: false,
    nearbyError: null,
    fetchUsers: async () => { },
    fetchUsersNearby: async () => { },
    toggleUserActive: async () => { },
    clearUsers: () => { },
    clearNearbyUsers: () => { },
};

const UsersContext = createContext<UsersContextType>(defaultContextValue);

type UsersContextProviderProps = {
    children: React.ReactNode;
};

export const UsersContextProvider: React.FC<UsersContextProviderProps> = ({ children }) => {
    // Regular users state
    const [users, setUsers] = useState<User[]>([]);
    const [usersPagination, setUsersPagination] = useState<Pagination | null>(null);
    const [usersLoading, setUsersLoading] = useState<boolean>(false);
    const [usersError, setUsersError] = useState<string | null>(null);

    // Nearby users state
    const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
    const [nearbyLoading, setNearbyLoading] = useState<boolean>(false);
    const [nearbyError, setNearbyError] = useState<string | null>(null);

    // Fetch regular users with pagination
    const fetchUsers = async (options = {}) => {
        setUsersLoading(true);
        setUsersError(null);
        try {
            const params = new URLSearchParams();
            const { page, limit, active, username } = options as {
                page?: number;
                limit?: number;
                active?: boolean;
                username?: string;
            };
            if (page !== undefined) params.append('page', page.toString());
            if (limit !== undefined) params.append('limit', limit.toString());
            if (active !== undefined) params.append('active', active.toString());
            if (username) params.append('username', username);
            const response = await api.get(`/users?${params}`);
            // Handle both paginated and non-paginated responses
            if (response.data.users) {
                // Paginated response
                setUsers(response.data.users || []);
                setUsersPagination(response.data.pagination || null);
            } else {
                // Non-paginated response
                setUsers(Array.isArray(response.data) ? response.data : []);
                setUsersPagination(null);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            setUsersError('Failed to fetch users');
        } finally {
            setUsersLoading(false);
        }
    };

    const fetchUsersNearby = async (coords: { lat: number; lng: number }, radius: number) => {
        setNearbyLoading(true);
        setNearbyError(null);
        try {
            const response = await api.get('/users/nearby', {
                params: {
                    longitude: coords.lng,
                    latitude: coords.lat,
                    radius,
                },
            });
            setNearbyUsers(response.data);
        } catch (error) {
            console.error('Error fetching nearby users:', error);
            setNearbyError('Failed to fetch nearby users');
        } finally {
            setNearbyLoading(false);
        }
    };

    // Toggle user active status (works on both regular and nearby users)
    const toggleUserActive = async (userId: number) => {
        try {
            // Find user in either users or nearbyUsers
            const regularUser = users.find(user => user.user_id === userId);
            const nearbyUser = nearbyUsers.find(user => user.user_id === userId);
            const currentUser = regularUser || nearbyUser;

            if (!currentUser) {
                throw new Error('User not found');
            }

            const { data } = await api.put(`/user/${userId}`, {
                active: !currentUser.active
            });

            // Simply toggle the active status locally
            const newActiveStatus = !currentUser.active;

            setUsers(prevUsers =>
                prevUsers.map(user =>
                    user.user_id === userId
                        ? { ...user, active: newActiveStatus }
                        : user
                )
            );

            // Update user in regular users if found there
            if (regularUser) {
                setUsers(prevUsers =>
                    prevUsers.map(user =>
                        user.user_id === userId
                            ? { ...user, active: data.user.active }
                            : user
                    )
                );
            }

            // Update user in nearby users if found there
            if (nearbyUser) {
                setNearbyUsers(prevUsers =>
                    prevUsers.map(user =>
                        user.user_id === userId
                            ? { ...user, active: data.user.active }
                            : user
                    )
                );
            }

        } catch (error) {
            console.error('Error toggling user active status:', error);
            setUsersError('Failed to update user status');
            setNearbyError('Failed to update user status');
            throw error;
        }
    };

    // Clear methods
    const clearUsers = () => {
        setUsers([]);
        setUsersPagination(null);
        setUsersError(null);
    };

    const clearNearbyUsers = () => {
        setNearbyUsers([]);
        setNearbyError(null);
    };

    return (
        <UsersContext.Provider
            value={{
                // Regular users
                users,
                usersPagination,
                usersLoading,
                usersError,

                // Nearby users
                nearbyUsers,
                nearbyLoading,
                nearbyError,

                // Methods
                fetchUsers,
                fetchUsersNearby,
                toggleUserActive,
                clearUsers,
                clearNearbyUsers,
            }}
        >
            {children}
        </UsersContext.Provider>
    );
};

export const useUsers = () => {
    const context = useContext(UsersContext);
    if (!context) {
        throw new Error('useUsers must be used within a UsersContextProvider');
    }
    return context;
};

// Export types for use in components
export type { User, NearbyUser, Pagination };
