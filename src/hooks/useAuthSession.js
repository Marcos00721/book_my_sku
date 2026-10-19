import { useEffect, useState } from 'react'
import { authConfigured, getAuthClient } from '../services/auth'

export function useAuthSession() {
  const [state, setState] = useState({ session: null, loading: authConfigured, error: null })

  useEffect(() => {
    if (!authConfigured) return
    let active = true
    const auth = getAuthClient().auth
    const { data: { subscription } } = auth.onAuthStateChange((_event, session) => {
      if (active) setState({ session, loading: false, error: null })
    })
    auth.getSession().then(({ data, error }) => {
      if (active) setState({ session: data.session, loading: false, error })
    }).catch(() => {
      if (active) setState({ session: null, loading: false, error: new Error('Your session could not be loaded. Please sign in again.') })
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  return state
}
