import { UserRole } from "./types";

const TOKEN_KEY = "qualitycat_academy_jwt";
const KNOWN_ROLES: UserRole[] = ["admin", "mentor", "student"];

const decodePayload = (token: string): Record<string, unknown> | null => {
  try {
    const parts = token.split(".");
    if (parts.length < 2) {
      return null;
    }

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;
    const rawPayload = atob(padded);
    return JSON.parse(rawPayload) as Record<string, unknown>;
  } catch {
    return null;
  }
};

export const getUserRoleFromToken = (token: string | null): UserRole | null => {
  if (!token) {
    return null;
  }

  const payload = decodePayload(token);
  const role = payload?.role;
  return typeof role === "string" && KNOWN_ROLES.includes(role as UserRole) ? (role as UserRole) : null;
};

export const authStorage = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  },
};
