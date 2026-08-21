import { Navigate, useNavigate } from 'react-router-dom'
import { AuthForm } from './AuthForm'
import { useAuth } from './AuthContext'
import { AuthPageFrame } from './LoginPage'

export function RegisterPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  if (auth.status === 'authenticated') return <Navigate to="/account" replace />
  return (
    <AuthPageFrame eyebrow="Join the exchange" title="Start as a customer. Grow from there."
      description="Every new account begins safely as a Customer. Seller access follows marketplace approval.">
      <AuthForm mode="register" onSubmit={async (input) => {
        await auth.register(input)
        navigate('/login', { replace: true, state: { registered: true } })
      }} />
    </AuthPageFrame>
  )
}
