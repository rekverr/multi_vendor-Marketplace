const REFRESH_TOKEN_KEY = 'marketplace.refresh-token'

export const authStorage = {
  read: (): string | null => sessionStorage.getItem(REFRESH_TOKEN_KEY),
  write: (token: string): void => sessionStorage.setItem(REFRESH_TOKEN_KEY, token),
  clear: (): void => sessionStorage.removeItem(REFRESH_TOKEN_KEY),
}
