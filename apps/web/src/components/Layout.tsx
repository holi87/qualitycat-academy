import { Link, NavLink, Outlet } from "react-router-dom";

type LayoutProps = {
  isAuthenticated: boolean;
  onLogout: () => void;
};

const Layout = ({ isAuthenticated, onLogout }: LayoutProps): JSX.Element => {
  return (
    <div className="layout">
      <header className="layout__header">
        <Link className="brand" to="/courses">
          qualitycat academy
        </Link>
        <nav className="layout__nav">
          <NavLink to="/courses">Courses</NavLink>
          <NavLink to="/login">Login</NavLink>
          {isAuthenticated ? (
            <button type="button" onClick={onLogout}>
              Logout
            </button>
          ) : null}
        </nav>
      </header>
      <main className="layout__main">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
