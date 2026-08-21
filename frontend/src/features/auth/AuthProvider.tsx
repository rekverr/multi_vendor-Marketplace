import { useEffect, useRef, useState, type ReactNode } from 'react'
import { configureApiAuth } from '../../api/client'
import { authApi } from './auth.api'
import { AuthContext, type AuthStatus } from './AuthContext'
import { authStorage } from './auth-storage'
import type { AuthResponse, AuthUser, LoginInput, RegisterInput, UserRole } from './auth.types'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('initializing')
  const [user, setUser] = useState<AuthUser | null>(null)
  const accessTokenRef = useRef<string | null>(null)
  const initialRefreshRef = useRef<Promise<string | null> | null>(null)

  function clearSession(): void {
    accessTokenRef.current = null
    authStorage.clear()
    setUser(null)
    setStatus('anonymous')
  }

  function establishSession(response: AuthResponse): void {
    accessTokenRef.current = response.accessToken
    authStorage.write(response.refreshToken)
    setUser(response.user)
    setStatus('authenticated')
  }

  useEffect(() => {
    const expire = (): void => {
      accessTokenRef.current = null
      authStorage.clear()
      setUser(null)
      setStatus('anonymous')
    }
    const refresh = async (): Promise<string | null> => {
      const refreshToken = authStorage.read()
      if (!refreshToken) return null
      try {
        const response = await authApi.refresh(refreshToken)
        accessTokenRef.current = response.accessToken
        authStorage.write(response.refreshToken)
        setUser(response.user)
        setStatus('authenticated')
        return response.accessToken
      } catch {
        expire()
        return null
      }
    }
    const removeBridge = configureApiAuth({
      getAccessToken: () => accessTokenRef.current,
      refresh,
      expire,
    })
    initialRefreshRef.current ??= Promise.resolve().then(refresh)
    void initialRefreshRef.current.finally(() => {
      setStatus((current) => current === 'initializing' ? 'anonymous' : current)
    })
    return removeBridge
  }, [])

  async function login(input: LoginInput): Promise<void> {
    establishSession(await authApi.login(input))
  }

  async function register(input: RegisterInput): Promise<void> {
    await authApi.register(input)
  }

  async function completeGoogleLogin(code: string, state: string): Promise<void> {
    establishSession(await authApi.googleCallback(code, state))
  }

  async function logout(): Promise<void> {
    const refreshToken = authStorage.read()
    clearSession()
    if (!refreshToken) return
    try {
      await authApi.logout(refreshToken)
    } catch {
      return
    }
  }

  function hasRole(...roles: UserRole[]): boolean {
    return user !== null && roles.includes(user.role)
  }

  return (
    <AuthContext value={{ status, user, login, register, completeGoogleLogin, logout, hasRole }}>
      {children}
    </AuthContext>
  )
}
