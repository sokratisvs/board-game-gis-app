import { useContext } from 'react';
// import MapComponent from './components/MapComponent/MapComponent';
import { AuthContext } from './context/Auth.context';
import Login from './components/Login/Login';
import './App.css';
import Main from './components/Main/Main';

const App = () => {
  const { isLoggedIn } = useContext(AuthContext);

  const render = () => {
    if (!isLoggedIn) 
    return <Login />;
  else
    return <Main />;
  }
  

  return (
    <div className="App">
        {render()}
    </div>
  );
}

export default App;
