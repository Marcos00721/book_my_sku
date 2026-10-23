import { useCallback, useEffect, useState } from 'react'
import { readData } from '../services/workspace'

export function useResource(path) {
  const [version, setVersion] = useState(0)
  const [state, setState] = useState({
    path: null,
    data: null,
    error: null,
    loading: true,
  })
  const reload = useCallback(() => setVersion((value) => value + 1), [])
  useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    readData(path, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ path, data, loading: false, error: null })
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ path, data: null, loading: false, error })
      })
    return () => controller.abort()
  }, [path, version])
  // A changed URL never exposes data from the previous organization or filter.
  return {
    ...(state.path === path
      ? state
      : { data: null, error: null, loading: Boolean(path) }),
    reload,
  }
}
