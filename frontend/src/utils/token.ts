import type { User } from "../types/auth.types";

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | undefined {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ?? undefined;
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function setUser(user: User | Record<string, unknown> | null) {
  if (!user) {
    localStorage.removeItem(USER_KEY);
    return;
  }
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getUser(): User | null {
  const user = localStorage.getItem(USER_KEY);
  if (!user) return null;
  try {
    return JSON.parse(user) as User;
  } catch {
    return null;
  }
}

export function clearUser() {
  localStorage.removeItem(USER_KEY);
}
