import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { authApi } from './auth.api'
import { AuthForm } from './AuthForm'
import { useAuth } from './AuthContext'

interface LoginLocationState { from?: string; registered?: boolean }

export function LoginPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as LoginLocationState | null
  if (auth.status === 'authenticated') return <Navigate to="/account" replace />

  return (
    <AuthPageFrame eyebrow="Welcome back" title="Your marketplace, in motion."
      description="Sign in to manage purchases, listings, and live marketplace activity.">
      {state?.registered && <div className="success-alert" role="status">Account created. Sign in with your new credentials.</div>}
      <AuthForm mode="login" onSubmit={async (input) => {
        await auth.login(input)
        navigate(state?.from ?? '/account', { replace: true })
      }} />
      <div className="auth-divider"><span>or</span></div>
      <a className="button button-google" href={authApi.googleEntryUrl()}>
        <span className="google-mark">G</span>Continue with Google
      </a>
    </AuthPageFrame>
  )
}

export function AuthPageFrame({ eyebrow, title, description, children }: {
  eyebrow: string; title: string; description: string; children: React.ReactNode
}) {
  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="Marketplace introduction">
        <span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p>
        <div className="story-stat"><strong>One account.</strong>
          <span>Customer, seller, or administrator access is assigned by the marketplace.</span>
        </div>
      </section>
      <section className="auth-panel">{children}</section>
    </main>
  )
}
