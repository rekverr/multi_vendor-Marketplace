import { apiRequest, apiUrl } from '../../api/client'
import type { AuthResponse, AuthUser, LoginInput, RegisterInput } from './auth.types'

export const authApi = {
  login: (input: LoginInput): Promise<AuthResponse> =>
    apiRequest('/auth/login', { method: 'POST', body: input }),
  async register(input: RegisterInput): Promise<AuthUser> {
    const response = await apiRequest<{ user: AuthUser }>('/auth/register', {
      method: 'POST',
      body: input,
    })
    return response.user
  },
  refresh: (refreshToken: string): Promise<AuthResponse> =>
    apiRequest('/auth/refresh', { method: 'POST', body: { refreshToken } }),
  logout: (refreshToken: string): Promise<void> =>
    apiRequest('/auth/logout', { method: 'POST', body: { refreshToken } }),
  me: (): Promise<AuthUser> => apiRequest('/auth/me', { authenticated: true }),
  googleEntryUrl: (): string => apiUrl('/auth/google'),
  googleCallback(code: string, state: string): Promise<AuthResponse> {
    const query = new URLSearchParams({ code, state })
    return apiRequest(`/auth/google/callback?${query.toString()}`)
  },
}
