import React from 'react'
import PathConstants from './pathConstants'

const Main = React.lazy(() => import('../components/Main/Main'))
const Users = React.lazy(() => import('../components/Users/Users'))
// const Settings = React.lazy(() => import('../components/Settings/Settings'))

const childrenRoutes = [
    { path: PathConstants.MAIN, element: <Main /> },
    { path: PathConstants.USERS, element: <Users /> },
        // { path: PathConstants.SETTINGS, element: <Settings /> },
]

export default childrenRoutes
