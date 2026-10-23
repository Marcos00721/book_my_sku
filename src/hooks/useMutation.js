import { useRef, useState } from 'react'
import { mutate } from '../services/workspace'

export function useMutation() {
  const locked = useRef(false)
  const saved = useRef(null)
  const [state, setState] = useState({
    pending: false,
    error: null,
    uncertain: false,
  })
  async function run(method, path, payload, options) {
    if (locked.current) return
    locked.current = true
    const intent = state.uncertain
      ? saved.current
      : { method, path, payload, options }
    saved.current = intent
    setState({ pending: true, error: null, uncertain: state.uncertain })
    try {
      const data = await mutate(
        intent.method,
        intent.path,
        intent.payload,
        intent.options,
      )
      saved.current = null
      setState({ pending: false, error: null, uncertain: false })
      return { data }
    } catch (error) {
      setState({
        pending: false,
        error,
        uncertain: !error.status || error.status >= 500 || error.status === 429,
      })
      return null
    } finally {
      locked.current = false
    }
  }
  return { ...state, run }
}
