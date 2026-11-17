import { useRef, useState } from 'react'
import { api } from '../services/api'
import { readData } from '../services/workspace'
import { useResource } from './useResource'

// Credentials and uncertain requests stay in this mounted owner flow only.
// Do not use mutate(): its shared fingerprint cache retains request bodies.
export function useSageConnection(base, enabled) {
  const path = `${base}/sage/connection`
  const resource = useResource(enabled ? path : null)
  const intent = useRef(null)
  const locked = useRef(false)
  const retryAt = useRef(0)
  const [state, setState] = useState({ pending: false, error: null, uncertain: false })

  async function refresh() {
    if (locked.current || intent.current || !enabled) return
    locked.current = true
    setState({ pending: true, error: null, uncertain: false })
    try {
      resource.accept(await readData(path))
      setState({ pending: false, error: null, uncertain: false })
    } catch (error) {
      resource.accept(null)
      setState({ pending: false, error, uncertain: false })
    } finally {
      locked.current = false
    }
  }

  async function run(action, payload) {
    if (locked.current || !enabled || retryAt.current > Date.now()) return null
    locked.current = true
    intent.current ??= { action, payload, key: crypto.randomUUID() }
    const request = intent.current
    setState({ pending: true, error: null, uncertain: true })
    try {
      const response = await api.post(`${path}/${request.action}`, request.payload, { idempotencyKey: request.key })
      if (!response?.data || !Number.isSafeInteger(response.data.revision)) {
        throw new Error('The response was interrupted. Retry the same request to recover it.')
      }
      intent.current = null
      retryAt.current = 0
      resource.accept(response.data)
      resource.reload()
      setState({ pending: false, error: null, uncertain: false })
      return { action: request.action }
    } catch (error) {
      const uncertain = !error.status || error.status >= 500 || error.status === 429
      // These documented admission failures happen before any operation.
      const admissionFailure = ['SAGE_DISABLED', 'SAGE_SCHEMA_REQUIRED'].includes(error.code)
      if (!uncertain || admissionFailure) intent.current = null
      retryAt.current = Date.now() + (error.retryAfterMs || 0)
      if ([401, 403].includes(error.status)) resource.accept(null)
      setState({ pending: false, error, uncertain: uncertain && !admissionFailure })
      return null
    } finally {
      locked.current = false
    }
  }

  return { ...resource, ...state, error: state.error || resource.error, refresh, run }
}
