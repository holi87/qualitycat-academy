import { Link, NavLink, Outlet } from "react-router-dom";

type LayoutProps = {
  isAuthenticated: boolean;
  onLogout: () => void;
};

const Layout = ({ isAuthenticated, onLogout }: LayoutProps): JSX.Element => {
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
            <NavLink to="/login" className={resolveNavClass}>
              Login
            </NavLink>
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
