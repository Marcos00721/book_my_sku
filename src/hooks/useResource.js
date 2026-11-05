import { useCallback, useEffect, useRef, useState } from 'react'
import { readData } from '../services/workspace'

export function useResource(path, { retainDataOnError = false } = {}) {
  const activeRequest = useRef(null)
  const [version, setVersion] = useState(0)
  const [state, setState] = useState({
    path: null,
    data: null,
    error: null,
    loading: true,
  })
  const reload = useCallback(() => setVersion((value) => value + 1), [])
  const accept = useCallback(
    (data) => {
      activeRequest.current?.abort()
      setState({ path, data, error: null, loading: false })
    },
    [path],
  )
  useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    activeRequest.current = controller
    readData(path, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ path, data, loading: false, error: null })
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState((previous) => ({
            path,
            data:
              retainDataOnError &&
              previous.path === path &&
              ![401, 403].includes(error.status)
                ? previous.data
                : null,
            loading: false,
            error,
          }))
      })
    return () => controller.abort()
  }, [path, version, retainDataOnError])
  // A changed URL never exposes data from the previous organization or filter.
  return {
    ...(!path
      ? { data: null, error: null, loading: false }
      : state.path === path
        ? state
        : { data: null, error: null, loading: Boolean(path) }),
    reload,
    accept,
  }
}
