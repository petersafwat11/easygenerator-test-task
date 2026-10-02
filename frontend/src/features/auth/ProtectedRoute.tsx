import { Navigate, Outlet, useLocation } from 'react-router'
import {
  LoadingScreen,
  UnavailableScreen,
} from '../../components/StatusScreens'
import { useAuth } from './useAuth'

/** Renders child routes only for a confirmed session. Never redirects early. */
export function ProtectedRoute() {
  const { state, retry } = useAuth()
  const location = useLocation()

  switch (state.status) {
    case 'checking':
      return <LoadingScreen />
    case 'unavailable':
      return <UnavailableScreen onRetry={retry} />
    case 'unauthenticated':
      return (
        <Navigate to="/signin" replace state={{ from: location.pathname }} />
      )
    case 'authenticated':
      return <Outlet />
  }
}
