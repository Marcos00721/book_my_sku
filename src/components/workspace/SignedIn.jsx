import { Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthSession } from '../../hooks/useAuthSession'
import { clearMutationIntents } from '../../services/workspace'
import { ErrorNotice, Loading } from './Elements'

export function SignedIn({ children }) {
  const auth = useAuthSession()
  useEffect(() => {
    clearMutationIntents()
    return clearMutationIntents
  }, [auth.session?.user?.id])
  if (auth.loading) return <Loading />
  if (auth.error) return <ErrorNotice error={auth.error} />
  if (!auth.session) return <Navigate to="/login" replace />
  if (!auth.session.user.email_confirmed_at)
    return <Navigate to="/register" replace />
  return <div key={auth.session.user.id}>{children}</div>
}
