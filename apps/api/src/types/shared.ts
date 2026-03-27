import { UserRole } from "@prisma/client";

export type Role = "admin" | "mentor" | "student";
export type CourseSortBy = "createdAt" | "title";
export type SessionSortBy = "createdAt" | "startsAt";
export type SortOrder = "asc" | "desc";

export type JwtUser = {
  userId: string;
  email: string;
  role: Role;
};

export type ApiErrorPayload = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

const roleMap: Record<UserRole, Role> = {
  ADMIN: "admin",
  MENTOR: "mentor",
  STUDENT: "student",
};

export const toRole = (role: UserRole): Role => roleMap[role];
export const isAdminOrMentor = (role: Role): boolean => role === "admin" || role === "mentor";
export const isStudent = (role: Role): boolean => role === "student";

export const parseDateInput = (value: string): Date | null => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
