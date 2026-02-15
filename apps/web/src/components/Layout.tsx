import { Link, NavLink, Outlet } from "react-router-dom";
import { UserRole } from "../lib/types";

type LayoutProps = {
  isAuthenticated: boolean;
  role: UserRole | null;
  showBugsLink: boolean;
  onLogout: () => void;
};

const Layout = ({ isAuthenticated, role, showBugsLink, onLogout }: LayoutProps): JSX.Element => {
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
          <nav className="layout__nav">
            <NavLink to="/courses" className={resolveNavClass}>
              Courses
            </NavLink>
            <NavLink to="/sessions" className={resolveNavClass}>
              Sessions
            </NavLink>
            <NavLink to="/my-bookings" className={resolveNavClass}>
              My bookings
            </NavLink>
            {role === "admin" ? (
              <NavLink to="/admin" className={resolveNavClass}>
                Admin
              </NavLink>
            ) : null}
            {showBugsLink ? (
              <NavLink to="/bugs" className={resolveNavClass}>
                Bugs
              </NavLink>
            ) : null}
            {!isAuthenticated ? (
              <NavLink to="/login" className={resolveNavClass}>
                Login
              </NavLink>
            ) : null}
            <a
              className="nav-link nav-link--external"
              href="/api/api-docs"
              target="_blank"
              rel="noreferrer"
            >
              API Docs
            </a>
            {isAuthenticated ? (
              <button className="nav-button" type="button" onClick={onLogout}>
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
