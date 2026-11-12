import { useEffect, useMemo, useRef } from 'react'
import { debounce } from '../utils/debounce'

/**
 * Stable debounced callback for event handlers / effects.
 * Latest `fn` is always used; pending calls clear on unmount.
 */
export function useDebouncedCallback(fn, delay = 400) {
  const fnRef = useRef(fn)
  fnRef.current = fn

  const debounced = useMemo(
    () => debounce((...args) => fnRef.current(...args), delay),
    [delay],
  )

  useEffect(() => () => debounced.cancel(), [debounced])

  return debounced
}
