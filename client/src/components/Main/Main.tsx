import { useContext } from 'react';

import { AuthContext } from '../../context/Auth.context';
import { useNavigate } from 'react-router-dom';

const Main = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const onLogout = (e: { preventDefault: () => void; }) => {
    e.preventDefault();
    logout(() => {
          navigate('/login')
    });
  }

  return (
    <div className="row">

      <div className="col-sm-8">
        <h1>
          Hello {user?.username || 'User'}
        </h1>
      </div>

      <div className="col-sm-4">
        <h1>
          <button onClick={onLogout}>Logout</button>
        </h1>
      </div>
    </div>
  );
}

export default Main;