/**
 * Global debounce helper — reuse anywhere instead of writing setTimeout logic again.
 *
 * @param {Function} fn - Function to delay
 * @param {number} [delay=400] - Wait time in ms after the last call
 * @returns {Function} Debounced function with `.cancel()` and `.flush(...args)`
 *
 * @example
 * const search = debounce((q) => api.get(`/search?q=${q}`), 400)
 * input.oninput = (e) => search(e.target.value)
 * // search.cancel()  — drop pending call
 * // search.flush(q)  — run now
 */
export function debounce(fn, delay = 400) {
  let timer = null

  function debounced(...args) {
    if (timer != null) window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      timer = null
      fn.apply(this, args)
    }, delay)
  }

  debounced.cancel = () => {
    if (timer == null) return
    window.clearTimeout(timer)
    timer = null
  }

  debounced.flush = (...args) => {
    debounced.cancel()
    return fn.apply(this, args)
  }

  return debounced
}
