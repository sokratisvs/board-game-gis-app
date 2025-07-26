import { LatLngExpression } from 'leaflet';
import { PropsWithChildren, createContext, useState } from 'react';
import axios from 'axios';

type UserStateType = {
  userId: string,
  username: string,
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
  setUser: (value: UserStateType) => { },
  setIsLoggedIn: (value: boolean) => { },
  setLoginPending: (value: boolean) => { },
  setLoginError: (error: LoginErrorType) => { },
  register: (name: string, email: string, password: string, callback: Function, type: any) => { },
  login: (email: string, password: string, callback: Function) => { },
  logout: (callback: Function) => { },
  setUserLocation: (location: LatLngExpression) => { },
}

export const AuthContext = createContext(initialState);

export const AuthContextProvider = ({ children }: PropsWithChildren<{}>) => {
  const [user, setUser] = useState<UserStateType>(undefined);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
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

      const locationResponse = await axios.get(`http://localhost:5000/location/${id}`);
      const location = locationResponse.data?.[0]?.coordinates;

      setUser({
        userId: id,
        username,
        coordinates: location,
        type: 'myLocation'
      });
      setLoginPending(false);
      setIsLoggedIn(true)
      return callback(null);
    } catch (error: any) {
      setLoginPending(false);
      setLoginError(error?.response?.data || error)
      return callback(error);
    }
  }

  const register = async (name: string, email: string, password: string, callback: Function, type?: string) => {
    setLoginPending(true);
    setLoginError(undefined);
    console.log('register type---', type)
    try {
      await axios.post('http://localhost:5000/register', {
        username: name,
        email,
        password,
        type
      });

      setLoginPending(false);
      return callback(null);
    } catch (error: any) {
      setLoginPending(false);
      setLoginError(error?.response?.data || error)
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

  // Update user's location
  const setUserLocation = (location: LatLngExpression) => {
    if (user) {
      setUser((prevUser) => prevUser ? ({
        ...prevUser,
        coordinates: location
      }) : prevUser);
    }
  };

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
        setUserLocation
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};