import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { UserRole } from "../lib/types";

type LayoutProps = {
  isAuthenticated: boolean;
  role: UserRole | null;
  showBugsLink: boolean;
  onLogout: () => void;
};

const Layout = ({ isAuthenticated, role, showBugsLink, onLogout }: LayoutProps): JSX.Element => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const resolveNavClass = ({ isActive }: { isActive: boolean }): string =>
    `nav-link${isActive ? " nav-link--active" : ""}`;

  return (
    <div className="layout">
      <div className="bg-mesh" aria-hidden="true" />
      <header className="layout__header">
        <div className="layout__header-inner">
          <Link className="brand" to="/courses">
            <span className="brand__name">qualitycat academy</span>
            <span className="brand__tag">training and mentoring</span>
          </Link>
          <button
            className="nav-hamburger"
            type="button"
            data-testid="nav-hamburger"
            aria-label="Toggle navigation"
            onClick={() => setMobileNavOpen((prev) => !prev)}
          >
            <span className="nav-hamburger__bar" />
            <span className="nav-hamburger__bar" />
            <span className="nav-hamburger__bar" />
          </button>
          <nav className={`layout__nav${mobileNavOpen ? " layout__nav--open" : ""}`}>
            <NavLink to="/courses" className={resolveNavClass} data-testid="nav-link-courses">
              Courses
            </NavLink>
            <NavLink to="/sessions" className={resolveNavClass} data-testid="nav-link-sessions">
              Sessions
            </NavLink>
            <NavLink to="/my-bookings" className={resolveNavClass} data-testid="nav-link-my-bookings">
              My bookings
            </NavLink>
            {role === "admin" ? (
              <NavLink to="/admin" className={resolveNavClass} data-testid="nav-link-admin">
                Admin
              </NavLink>
            ) : null}
            {role === "admin" ? (
              <NavLink to="/users" className={resolveNavClass} data-testid="nav-link-users">
                Users
              </NavLink>
            ) : null}
            {showBugsLink ? (
              <NavLink to="/bugs" className={resolveNavClass} data-testid="nav-link-bugs">
                Bugs
              </NavLink>
            ) : null}
            {isAuthenticated ? (
              <NavLink to="/profile" className={resolveNavClass} data-testid="nav-link-profile">
                Profile
              </NavLink>
            ) : null}
            {!isAuthenticated ? (
              <NavLink to="/login" className={resolveNavClass} data-testid="nav-link-login">
                Login
              </NavLink>
            ) : null}
            {!isAuthenticated ? (
              <NavLink to="/register" className={resolveNavClass} data-testid="nav-link-register">
                Register
              </NavLink>
            ) : null}
            <a
              className="nav-link nav-link--external"
              href="/api/api-docs"
              target="_blank"
              rel="noreferrer"
              data-testid="nav-link-api-docs"
            >
              API Docs
            </a>
            {isAuthenticated ? (
              <button
                className="nav-button"
                type="button"
                data-testid="nav-logout"
                onClick={onLogout}
              >
                Logout
              </button>
            ) : null}
          </nav>
        </div>
      </header>
      <main className="layout__main">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
