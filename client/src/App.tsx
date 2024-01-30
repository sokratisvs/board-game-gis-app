// import MapComponent from './components/MapComponent/MapComponent';
import Layout from './components/Layout/Layout';
import Login from './components/Login/Login';
import Register from './components/Register/Register';

import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom"
import childrenRoutes from './routes'
import PathConstants from './routes/pathConstants'
import './App.css';
import Page404 from './components/Page404/Page404';

const App = () => {
  const router = createBrowserRouter([
    {
      element: <Layout />,
      errorElement: <Page404 />,
      children: childrenRoutes
    },
    { path: PathConstants.LOGIN, element: <Login /> },
    { path: PathConstants.REGISTER, element: <Register /> },
  ])

  return (
    <div className="App">
      <RouterProvider router={router} />     
    </div>

  );
}

export default App;
