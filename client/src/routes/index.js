import React from 'react'
import PathConstants from './pathConstants'

const Main = React.lazy(() => import('../components/Main/Main'))

const childrenRoutes = [{ path: PathConstants.MAIN, element: <Main /> }]

export default childrenRoutes
