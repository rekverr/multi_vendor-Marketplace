import { useAuth } from '../features/auth/AuthContext'

export function AccountPage() {
  const auth = useAuth()
  return (
    <main className="account-page"><span className="eyebrow">Authenticated account</span><h1>Good to see you.</h1>
      <section className="account-card"><div><span>Email</span><strong>{auth.user?.email}</strong></div>
        <div><span>Marketplace role</span><strong>{auth.user?.role}</strong></div></section>
      <p className="account-note">Catalog, cart, and dashboard experiences will be added in their dedicated features.</p>
    </main>
  )
}
