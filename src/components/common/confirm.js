/**
 * Imperative confirm bridge. ConfirmProvider registers the implementation;
 * askConfirm() works from hooks, event listeners, and plain modules.
 */

let impl = null

/** @param {((options: ConfirmOptions) => Promise<boolean>) | null} fn */
export function registerConfirm(fn) {
  impl = fn
}

/**
 * @typedef {object} ConfirmOptions
 * @property {string} [title]
 * @property {string} message
 * @property {string} [confirmLabel]
 * @property {string} [cancelLabel]
 * @property {'primary' | 'danger'} [tone]
 */

/**
 * @param {ConfirmOptions | string} options
 * @returns {Promise<boolean>}
 */
export function askConfirm(options) {
  const opts =
    typeof options === 'string' ? { message: options } : options || {}
  if (!opts.message) return Promise.resolve(false)
  if (!impl) {
    console.warn('ConfirmProvider is not mounted; confirm was denied.')
    return Promise.resolve(false)
  }
  return impl({
    title: opts.title || 'Please confirm',
    message: opts.message,
    confirmLabel: opts.confirmLabel || 'Confirm',
    cancelLabel: opts.cancelLabel || 'Cancel',
    tone: opts.tone || 'primary',
  })
}
