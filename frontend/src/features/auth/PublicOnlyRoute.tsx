import { Navigate, Outlet } from 'react-router'
import {
  LoadingScreen,
  UnavailableScreen,
} from '../../components/StatusScreens'
import { useAuth } from './useAuth'

/** Sign-in and sign-up pages: a signed-in user is sent to the app instead. */
export function PublicOnlyRoute() {
  const { state, retry } = useAuth()

  switch (state.status) {
    case 'checking':
      return <LoadingScreen />
    case 'unavailable':
      return <UnavailableScreen onRetry={retry} />
    case 'authenticated':
      return <Navigate to="/app" replace />
    case 'unauthenticated':
      return <Outlet />
  }
}
