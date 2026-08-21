import { AuthProvider } from '../features/auth/AuthProvider'
import { AppShell } from './AppShell'

export function AppRoot() {
  return <AuthProvider><AppShell /></AuthProvider>
}
