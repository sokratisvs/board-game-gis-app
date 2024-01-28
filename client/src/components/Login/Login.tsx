import { useContext, useState } from 'react';
import { AuthContext } from '../../context/Auth.context';

const initialState = {
    email: '',
    password: '',
  }

export default function Login() {
  const { isLoggedIn, loginPending, loginError, login } = useContext(AuthContext);
  const [state, setState] = useState(initialState);

  const onSubmit = (e: { preventDefault: () => void; }) => {
    e.preventDefault();
    const { email, password } = state;
    login(email, password);
    setState({
      email: '',
      password: ''
    });
  }

  return (
    <form name="loginForm" onSubmit={onSubmit}>
        <div className="row">

        <div className="col-sm-3 col-md-6">
        <label htmlFor="email">Username</label>
        </div>

        <div className="col-sm-9 col-md-6">
        <input 
            type="text" 
            name="email" 
            onChange={e => setState((prev) => ({...prev, email: e.target.value}))} 
            value={state.email} 
            placeholder="email" 
        />
        </div>

        <div className="col-sm-3 col-md-6">
        <label htmlFor="password">Password</label>
        </div>
        <div className="col-sm-9 col-md-6">
            <input 
            type="password" 
            name="password" 
            onChange={e => setState((prev) => ({...prev, password: e.target.value}))} 
            value={state.password} 
            placeholder="password"
            />
        </div>

        <div className="col-sm-3 col-md-6">
        </div>
        <div className="col-sm-9 col-md-6">
        <input className="primary" type="submit" value="Login" />
        </div>

        </div>
        { loginPending && <div>Please wait...</div> }
        { isLoggedIn && <div>Success.</div> }
        { loginError && <div>{loginError.message}</div> }
    </form>

  )
}
