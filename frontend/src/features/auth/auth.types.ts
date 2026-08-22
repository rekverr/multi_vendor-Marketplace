export type UserRole = "CUSTOMER" | "SELLER" | "ADMIN";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresInSeconds: number;
}

export interface LoginInput {
  email: string;
  password: string;
}
export type RegisterInput = LoginInput;
