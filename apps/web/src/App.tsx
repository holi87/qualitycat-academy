import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, Route, Routes } from "react-router-dom";

import Layout from "./components/Layout";
import { useToast } from "./components/ToastProvider";
import { authStorage, getUserRoleFromToken } from "./lib/auth";
import { applyPublicBugState, useRuntimeBugState } from "./lib/bugs";
import { apiRequest } from "./lib/http";
import { PublicBugsStateResponse } from "./lib/types";
import AdminPage from "./pages/AdminPage";
import CourseDetailsPage from "./pages/CourseDetailsPage";
import CourseFormPage from "./pages/CourseFormPage";
import CoursesPage from "./pages/CoursesPage";
import BugsPage from "./pages/BugsPage";
import LoginPage from "./pages/LoginPage";
import MyBookingsPage from "./pages/MyBookingsPage";
import ProfilePage from "./pages/ProfilePage";
import RegisterPage from "./pages/RegisterPage";
import SessionFormPage from "./pages/SessionFormPage";
import SessionsPage from "./pages/SessionsPage";
import UsersPage from "./pages/UsersPage";

const App = (): JSX.Element => {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => authStorage.getToken());
  const runtimeBugs = useRuntimeBugState();
  const toast = useToast();
  const role = useMemo(() => getUserRoleFromToken(token), [token]);
  const canAccessInternalBugs = role === "admin" || role === "mentor";

  const bugStateQuery = useQuery({
    queryKey: ["bugs", "public-state"],
    queryFn: ({ signal }) =>
      apiRequest<PublicBugsStateResponse>("/bugs/public-state", {
        signal,
      }),
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!bugStateQuery.data) {
      return;
    }

    applyPublicBugState(bugStateQuery.data.data);
  }, [bugStateQuery.data]);

  useEffect(() => {
    queryClient.setDefaultOptions({
      queries: {
        staleTime: runtimeBugs.frontendBugs ? Number.POSITIVE_INFINITY : 0,
        refetchOnWindowFocus: !runtimeBugs.frontendBugs,
      },
    });
  }, [queryClient, runtimeBugs.frontendBugs]);

  const clearAuth = useCallback((): void => {
    authStorage.clearToken();
    setToken(null);
  }, []);

  const handleAuth = useCallback((nextToken: string) => {
    authStorage.setToken(nextToken);
    setToken(nextToken);
  }, []);

  const auth = useMemo(
    () => ({
      token,
      isAuthenticated: Boolean(token),
      login: handleAuth,
      logout: () => {
        clearAuth();
        toast.info("Logged out.");
      },
    }),
    [clearAuth, handleAuth, token, toast],
  );

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Layout
            isAuthenticated={auth.isAuthenticated}
            role={role}
            showBugsLink={canAccessInternalBugs}
            onLogout={auth.logout}
          />
        }
      >
        <Route index element={<Navigate to="/courses" replace />} />
        <Route path="login" element={<LoginPage onLogin={auth.login} />} />
        <Route path="register" element={<RegisterPage onRegister={auth.login} />} />
        <Route path="courses" element={<CoursesPage token={auth.token} role={role} />} />
        <Route path="courses/new" element={<CourseFormPage token={auth.token} />} />
        <Route path="courses/:id" element={<CourseDetailsPage token={auth.token} role={role} />} />
        <Route path="courses/:id/edit" element={<CourseFormPage token={auth.token} />} />
        <Route path="sessions" element={<SessionsPage token={auth.token} role={role} />} />
        <Route path="sessions/new" element={<SessionFormPage token={auth.token} />} />
        <Route path="my-bookings" element={<MyBookingsPage token={auth.token} />} />
        <Route path="profile" element={<ProfilePage token={auth.token} />} />
        {role === "admin" ? <Route path="users" element={<UsersPage token={auth.token} />} /> : null}
        <Route path="admin" element={<AdminPage token={auth.token} role={role} onResetDone={clearAuth} />} />
        {canAccessInternalBugs ? <Route path="bugs" element={<BugsPage token={auth.token} />} /> : null}
      </Route>
      <Route path="*" element={<Navigate to="/courses" replace />} />
    </Routes>
  );
};

export default App;
