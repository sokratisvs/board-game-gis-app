import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App'
import reportWebVitals from './reportWebVitals'
import { AuthContextProvider } from './context/Auth.context'
import { LocationProvider } from './context/Location.context'
import { UsersContextProvider } from './context/Users.context'

;(window as any).__BUILD_HASH__ = import.meta.env.VITE_BUILD_HASH ?? 'unknown'
console.log('Frontend build:', import.meta.env.VITE_BUILD_HASH)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 min
      gcTime: 5 * 60 * 1000, // 5 min (formerly cacheTime)
    },
  },
})

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthContextProvider>
        <LocationProvider>
          <UsersContextProvider>
            <App />
          </UsersContextProvider>
        </LocationProvider>
      </AuthContextProvider>
    </QueryClientProvider>
  </React.StrictMode>
)

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
