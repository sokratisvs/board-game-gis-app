import { useEffect } from 'react'
import { useUsers } from '../../context/Users.context'
import './Users.css'

const UserList = () => {
  const {
    users,
    usersPagination,
    usersLoading,
    usersError,
    fetchUsers,
    toggleUserActive,
  } = useUsers()

  useEffect(() => {
    fetchUsers({
      page: 1,
      limit: 20,
      active: undefined, // Don't filter by active status
    })
  }, [fetchUsers])

  const handleToggle = async (userId: number) => {
    await toggleUserActive(userId)
  }

  const handlePageChange = (page: number) => {
    fetchUsers({ page, limit: 20 }) // Keep limit of 20
  }

  const handleActiveFilter = (active?: boolean) => {
    fetchUsers({
      page: 1,
      limit: 20,
      active,
    })
  }

  if (usersLoading)
    return (
      <div
        className="p-6 text-center text-slate-600"
        role="status"
        aria-live="polite"
      >
        Loading users…
      </div>
    )
  if (usersError)
    return (
      <div
        className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200"
        role="alert"
      >
        Error: {usersError}
      </div>
    )

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <h2 className="text-xl font-semibold text-slate-800 p-4 border-b border-slate-200 bg-white">
        Users
      </h2>

      {/* Filter buttons */}
      <div className="flex flex-wrap gap-2 p-4 border-b border-slate-200 bg-slate-50">
        <button
          type="button"
          onClick={() => handleActiveFilter(undefined)}
          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-200 text-slate-800 hover:bg-slate-300 focus:ring-2 focus:ring-offset-1 focus:ring-slate-400"
        >
          All Users
        </button>
        <button
          type="button"
          onClick={() => handleActiveFilter(true)}
          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-200 text-slate-800 hover:bg-slate-300 focus:ring-2 focus:ring-offset-1 focus:ring-slate-400"
        >
          Active Only
        </button>
        <button
          type="button"
          onClick={() => handleActiveFilter(false)}
          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-200 text-slate-800 hover:bg-slate-300 focus:ring-2 focus:ring-offset-1 focus:ring-slate-400"
        >
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
              <div
                key={user.user_id || user.user_id || `user-${user.email}`}
                className="user-row"
              >
                <div>{user.user_id || user.user_id}</div>
                <div>{user.username}</div>
                <div>{user.email}</div>
                <div>{user.type}</div>
                <div>
                  <span
                    className={`status-badge ${user.active ? 'active' : 'inactive'}`}
                  >
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
                        : 'Activate'}
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
  )
}

export default UserList
