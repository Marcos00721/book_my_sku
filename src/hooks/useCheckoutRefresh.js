import { useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../services/api'
import { getAuthClient } from '../services/auth'

// A return URL only requests provider reconciliation. It never confirms payment.
export function useCheckoutRefresh({ snapshot, returned, enabled, accept }) {
  const operation = useRef(null)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ key: null, pending: false, error: null })
  const applicationId = snapshot.application?.id
  const reason = returned ? 'return' : snapshot.nextAction === 'refresh_billing'
    ? `refresh:${snapshot.billing?.revision ?? snapshot.billing?.status}` : null
  const key = enabled && applicationId && reason
    ? `${snapshot.actorId}:${applicationId}:${reason}:${attempt}`
    : null

  useEffect(() => {
    if (!key) return
    let active = true
    if (operation.current?.key !== key) {
      const promise = (async () => {
        const { data } = await getAuthClient().auth.getSession()
        const subject = data.session?.user.id
        if (!subject) throw new Error('Sign in again to check your payment.')
        const response = await api.post(`/applications/${applicationId}/billing/refresh`, {})
        if (typeof response?.data?.billingEligible !== 'boolean')
          throw new ApiError('The server returned an unexpected billing status. Please retry.', { status: 502, code: 'INVALID_RESPONSE' })
        const current = await getAuthClient().auth.getSession()
        if (current.data.session?.user.id !== subject)
          throw new Error('Your account changed. Reload before checking payment.')
        const journey = (await api.get('/onboarding/journey')).data
        if (!journey?.actorId || typeof journey.nextAction !== 'string')
          throw new ApiError('The server returned an unexpected setup status. Please retry.', { status: 502, code: 'INVALID_RESPONSE' })
        return { journey, billing: response.data }
      })()
      operation.current = { key, promise }
    }
    operation.current.promise.then(
      result => {
        if (!active) return
        const next = result.journey
        if (next.actorId !== snapshot.actorId) {
          setState({ key, pending: false, error: new Error('Your account changed. Reload before continuing.') })
          return
        }
        setState({ key, pending: false, error: null, billing: result.billing })
        accept(next)
      },
      error => {
        if (operation.current?.key === key)
          operation.current.retryAt = Date.now() + (error.retryAfterMs || 0)
        if (active) setState({ key, pending: false, error })
      },
    )
    return () => { active = false }
  }, [key, applicationId, snapshot.actorId, accept])

  const pending = Boolean(key && (state.key !== key || state.pending))
  return {
    pending,
    error: state.key === key ? state.error : null,
    billing: state.key === key ? state.billing : null,
    retry: () => {
      if (Date.now() < (operation.current?.retryAt || 0)) return
      setAttempt(value => value + 1)
    },
  }
}
