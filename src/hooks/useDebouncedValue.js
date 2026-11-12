import { useEffect, useState } from 'react'

/**
 * Debounce any changing value (search text, filters, etc.).
 * Prefer this in components; use `debounce()` from `src/utils/debounce.js` for callbacks.
 */
export function useDebouncedValue(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])

  return debounced
}
