import React from 'react'
import PathConstants from './pathConstants'

const Map = React.lazy(() => import('../components/Map/Map'))
const Users = React.lazy(() => import('../components/Users/Users'))
const Dashboard = React.lazy(() => import('../components/Dashboard/Dashboard'))
const Settings = React.lazy(() => import('../components/Settings/Settings'))

const childrenRoutes = [
  { path: PathConstants.DASHBOARD, element: <Dashboard /> },
  { path: PathConstants.USERS, element: <Users /> },
  { path: PathConstants.MAP, element: <Map /> },
  { path: PathConstants.SETTINGS, element: <Settings /> },
]

export default childrenRoutes
