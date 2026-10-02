import { useAuth } from '../features/auth/useAuth'

export function AppPage() {
  const { state } = useAuth()
  if (state.status !== 'authenticated') return null
  return (
    <main className="p-6">
      <h1>Welcome to the application.</h1>
      <p>{state.user.name}</p>
    </main>
  )
}
