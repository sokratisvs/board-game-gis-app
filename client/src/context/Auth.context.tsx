// import { LatLngExpression } from 'leaflet';    // TODO install leaflet 
import { PropsWithChildren, createContext, useState } from 'react';
import axios from 'axios';

type UserStateType = {
  username: string,
    // coordinates: LatLngExpression,
    type: 'myLocation'
} | undefined;

type LoginErrorType = {
    message: 'string'
} | undefined;

const initialState = {
    user: {} as any,
    isLoggedIn: false,
    loginPending: false,
    loginError: null as any,
    setUser: (value: UserStateType) => {},
    setIsLoggedIn: (value: boolean) => {},
    setLoginPending: (value: boolean) => {},
    setLoginError: (error: LoginErrorType) => {},
    register: (name: string, email: string, password: string, callback: Function) => {},
    login: (email: string, password: string, callback: Function) => {},
    logout: (callback: Function) => {},
  }

export const AuthContext = createContext(initialState);

  export const AuthContextProvider = ({ children }: PropsWithChildren<{}>) => {
    const [user, setUser] = useState<UserStateType>(undefined);
    const [isLoggedIn, setIsLoggedIn]  = useState(false);
    const [loginPending, setLoginPending] = useState(false);
    const [loginError, setLoginError] = useState<LoginErrorType>(undefined);
  
    const login = async (email: string, password: string, callback: Function) => {
      setLoginPending(true);
      setUser(undefined);
      setLoginError(undefined);

      try {

        const response = await axios.post('http://localhost:5000/login', {
          email,
          password
        });

        const { username, id } = response?.data || {}
            setUser({
              username,
                // coordinates: [],
                type: 'myLocation'
            });
        setLoginPending(false);
        setIsLoggedIn(true)
        return callback(null);
      } catch(error: any) {
        setLoginPending(false);
        setLoginError(error)
        return callback(error);
      }
      }

    const register = async (name: string, email: string, password: string, callback: Function) => {
      setLoginPending(true);
      setLoginError(undefined);

      try {
        await axios.post('http://localhost:5000/register', {
          username: name,
          email,
          password
        });

        setLoginPending(false);
        return callback(null);
      } catch(error: any) {
        setLoginPending(false);
        setLoginError(error)
        return callback(error);
      }
    }
  
    const logout = (callback: Function) => {
      setLoginPending(false);
      setIsLoggedIn(false)
      setUser(undefined);
      setLoginError(undefined);
      return callback(null);
    }
  
    return (
      <AuthContext.Provider
        value={{
            user, 
            setUser,
            isLoggedIn,
            setIsLoggedIn,
            loginPending, 
            setLoginPending,
            loginError, 
            setLoginError,
            login,
            register,
            logout,
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  };