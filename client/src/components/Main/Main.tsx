import { useContext } from 'react';

import { AuthContext } from '../../context/Auth.context';

const Main = () => {
  const { logout } = useContext(AuthContext);
  const onLogout = (e: { preventDefault: () => void; }) => {
    e.preventDefault();
    logout();
  }

  return (
    <div className="row">

      <div className="col-sm-8">
        <h1>
          Hello Admin
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