import { useMemo, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import Layout from "./components/Layout";
import { useToast } from "./components/ToastProvider";
import { authStorage } from "./lib/auth";
import { isUiBugModeEnabled } from "./lib/bugs";
import CourseDetailsPage from "./pages/CourseDetailsPage";
import CoursesPage from "./pages/CoursesPage";
import BugsPage from "./pages/BugsPage";
import LoginPage from "./pages/LoginPage";
import MyBookingsPage from "./pages/MyBookingsPage";
import SessionsPage from "./pages/SessionsPage";

const App = (): JSX.Element => {
  const [token, setToken] = useState<string | null>(() => authStorage.getToken());
  const toast = useToast();

  const auth = useMemo(
    () => ({
      token,
      isAuthenticated: Boolean(token),
      login: (nextToken: string) => {
        authStorage.setToken(nextToken);
        setToken(nextToken);
      },
      logout: () => {
        authStorage.clearToken();
        setToken(null);
        toast.info("Logged out.");
      },
    }),
    [token, toast],
  );

  return (
    <Routes>
      <Route
        path="/"
        element={<Layout isAuthenticated={auth.isAuthenticated} onLogout={auth.logout} />}
      >
        <Route index element={<Navigate to="/courses" replace />} />
        <Route path="login" element={<LoginPage onLogin={auth.login} />} />
        <Route path="courses" element={<CoursesPage token={auth.token} />} />
        <Route path="courses/:id" element={<CourseDetailsPage token={auth.token} />} />
        <Route path="sessions" element={<SessionsPage token={auth.token} />} />
        <Route path="my-bookings" element={<MyBookingsPage token={auth.token} />} />
        {isUiBugModeEnabled() ? <Route path="bugs" element={<BugsPage token={auth.token} />} /> : null}
      </Route>
      <Route path="*" element={<Navigate to="/courses" replace />} />
    </Routes>
  );
};

export default App;
