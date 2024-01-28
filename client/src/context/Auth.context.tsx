import { LatLngExpression } from 'leaflet';
import { PropsWithChildren, createContext, useState } from 'react';

type UserStateType = {
    coordinates: LatLngExpression,
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
    login: (email: string, password: string) => {},
    logout: () => {},
  }

export const AuthContext = createContext(initialState);
  // TODO fetch user from endpoint
  const fetchLogin = (email: string, password: string, callback: Function) => 
  setTimeout(() => {
    if (email === 'admin' && password === 'admin') {
      return callback(null);
    } else {
      return callback(new Error('Invalid email and password'));
    }
  }, 1000);

  export const AuthContextProvider = ({ children }: PropsWithChildren<{}>) => {
    const [user, setUser] = useState<UserStateType>(undefined);
    const [isLoggedIn, setIsLoggedIn]  = useState(false);
    const [loginPending, setLoginPending] = useState(false);
    const [loginError, setLoginError] = useState<LoginErrorType>(undefined);
  
    const login = (email: string, password: string) => {
      setLoginPending(true);
      setUser(undefined);
      setLoginError(undefined);
  
      fetchLogin(email, password, (error: any) => {
        setLoginPending(false);
  
        if (!error) {
            setIsLoggedIn(true)
            // TODO setUser from endpoint
            // setUser({
            //     // coordinates: [],
            //     type: 'myLocation'
            // });
        } else {
          setLoginError(error);
        }
      })
    }
  
    const logout = () => {
      setLoginPending(false);
      setIsLoggedIn(false)
      setUser(undefined);
      setLoginError(undefined);
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
            logout,
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  };