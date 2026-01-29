import Layout from './components/Layout/Layout'
import Login from './components/Login/Login'
import Register from './components/Register/Register'

import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import childrenRoutes from './routes'
import PathConstants from './routes/pathConstants'
import './App.css'
import Page404 from './components/Page404/Page404'

const basePath = process.env.REACT_APP_BASE_PATH || ''

const App = () => {
  const router = createBrowserRouter(
    [
      {
        element: <Layout />,
        errorElement: <Page404 />,
        children: childrenRoutes,
      },
      { path: PathConstants.LOGIN, element: <Login /> },
      { path: PathConstants.REGISTER, element: <Register /> },
    ],
    { basename: basePath }
  )

  return (
    <div className="App">
      <RouterProvider router={router} />
    </div>
  )
}

export default App
