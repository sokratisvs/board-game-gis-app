import { useEffect } from 'react';
import { useUsers } from '../../context/Users.context';
import "./Users.css";

const UserList = () => {
    const {
        users,
        usersPagination,
        usersLoading,
        usersError,
        fetchUsers,
        toggleUserActive
    } = useUsers();

    useEffect(() => {
        fetchUsers({
            page: 1,
            limit: 20,
            active: undefined // Don't filter by active status
        });
    }, [fetchUsers]);

    const handleToggle = async (userId: number) => {
        await toggleUserActive(userId);
    };

    const handlePageChange = (page: number) => {
        fetchUsers({ page, limit: 20 }); // Keep limit of 20
    };

    const handleActiveFilter = (active?: boolean) => {
        fetchUsers({
            page: 1,
            limit: 20,
            active
        });
    };

    if (usersLoading) return <div className="loading">Loading users...</div>;
    if (usersError) return <div className="error">Error: {usersError}</div>;

    return (
        <div className="user-list">
            <h2>Users</h2>

            {/* Filter buttons */}
            <div className="filter-buttons">
                <button onClick={() => handleActiveFilter(undefined)} className="filter-btn">
                    All Users
                </button>
                <button onClick={() => handleActiveFilter(true)} className="filter-btn">
                    Active Only
                </button>
                <button onClick={() => handleActiveFilter(false)} className="filter-btn">
                    Inactive Only
                </button>
            </div>

            <div className="user-table-container">
                <div className="user-table">
                    <div className="user-table-header">
                        <div>ID</div>
                        <div>Name</div>
                        <div>Email</div>
                        <div>Type</div>
                        <div>Status</div>
                        <div>Actions</div>
                    </div>

                    {users.length > 0 ? (
                        users.map((user) => (
                            <div key={user.user_id || user.user_id || `user-${user.email}`} className="user-row">
                                <div>{user.user_id || user.user_id}</div>
                                <div>{user.username}</div>
                                <div>{user.email}</div>
                                <div>{user.type}</div>
                                <div>
                                    <span className={`status-badge ${user.active ? 'active' : 'inactive'}`}>
                                        {user.active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <div>
                                    <button
                                        onClick={() => handleToggle(user.user_id)}
                                        disabled={usersLoading}
                                        className={`toggle-btn ${user.active ? 'deactivate' : 'activate'}`}
                                    >
                                        {usersLoading
                                            ? 'Loading...'
                                            : user.active
                                                ? 'Deactivate'
                                                : 'Activate'
                                        }
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p>No users found.</p>
                    )}
                </div>
                {/* Pagination */}
                {usersPagination && usersPagination.totalPages > 1 && (
                    <div className="pagination">
                        <button
                            onClick={() => handlePageChange(usersPagination.currentPage - 1)}
                            disabled={!usersPagination.hasPreviousPage}
                        >
                            Previous
                        </button>
                        <span>
                            Page {usersPagination.currentPage} of {usersPagination.totalPages}
                        </span>
                        <button
                            onClick={() => handlePageChange(usersPagination.currentPage + 1)}
                            disabled={!usersPagination.hasNextPage}
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserList;
