import { createBrowserRouter } from 'react-router-dom'
import { GoogleCallbackPage } from '../features/auth/GoogleCallbackPage'
import { LoginPage } from '../features/auth/LoginPage'
import { ProtectedRoute } from '../features/auth/ProtectedRoute'
import { RegisterPage } from '../features/auth/RegisterPage'
import { AccountPage } from '../pages/AccountPage'
import { HomePage } from '../pages/HomePage'
import { RoleLandingPage } from '../pages/RoleLandingPage'
import { StatusPage } from '../pages/StatusPage'
import { AppRoot } from './AppRoot'

export const router = createBrowserRouter([{
  element: <AppRoot />,
  children: [
    { path: '/', element: <HomePage /> },
    { path: '/login', element: <LoginPage /> },
    { path: '/register', element: <RegisterPage /> },
    { path: '/auth/google/callback', element: <GoogleCallbackPage /> },
    { path: '/forbidden', element: <StatusPage forbidden /> },
    { element: <ProtectedRoute />, children: [{ path: '/account', element: <AccountPage /> }] },
    { element: <ProtectedRoute roles={['SELLER']} />, children: [{ path: '/seller', element: <RoleLandingPage area="Seller" /> }] },
    { element: <ProtectedRoute roles={['ADMIN']} />, children: [{ path: '/admin', element: <RoleLandingPage area="Admin" /> }] },
    { path: '*', element: <StatusPage /> },
  ],
}])
