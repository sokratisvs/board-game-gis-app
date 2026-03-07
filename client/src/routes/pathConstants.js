const PathConstants = {
  MAP: '/map',
  MATCHES: '/matches',
  EXPLORATION_ROUTES: '/exploration/routes',
  EXPLORATION_ROUTE_EDIT: '/exploration/routes/:id/edit',
  /** Build edit URL for an exploration route by id. */
  explorationRouteEdit: (id) => `/exploration/routes/${id}/edit`,
  LOGIN: 'login',
  REGISTER: 'register',
  USERS: '/users',
  DASHBOARD: '/',
  SETTINGS: '/settings',
}

export default PathConstants
