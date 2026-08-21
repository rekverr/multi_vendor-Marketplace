import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'

export function AppShell() {
  const auth = useAuth()
  return (
    <div className="app-shell">
      <header className="site-header">
        <NavLink className="brand" to="/"><span className="brand-mark">M</span><span>Marketline</span></NavLink>
        <nav aria-label="Main navigation">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/products">Catalog</NavLink>
          {auth.status === 'authenticated' ? <>
            <NavLink to="/account">Account</NavLink>
            {auth.hasRole('SELLER') && <NavLink to="/seller">Seller</NavLink>}
            {auth.hasRole('ADMIN') && <NavLink to="/admin">Admin</NavLink>}
            <button className="nav-action" onClick={() => void auth.logout()}>Sign out</button>
          </> : <>
            <NavLink to="/login">Sign in</NavLink><NavLink className="nav-join" to="/register">Join</NavLink>
          </>}
        </nav>
      </header>
      <Outlet />
      <footer className="site-footer"><span>Marketline marketplace foundation</span><span>PostgreSQL remains authoritative</span></footer>
    </div>
  )
}
