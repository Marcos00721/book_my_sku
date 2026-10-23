import { api, ApiError } from './api'

export function queryPath(path, values = {}) {
  const query = new URLSearchParams(
    Object.entries(values).filter(([, value]) => value !== '' && value != null),
  )
  return `${path}${query.size ? `?${query}` : ''}`
}

export async function readData(path, options) {
  const response = await api.get(path, options)
  if (
    !response?.data ||
    typeof response.data !== 'object' ||
    Array.isArray(response.data)
  )
    throw new ApiError('The server returned an unexpected response.', {
      status: 502,
      code: 'INVALID_RESPONSE',
    })
  return response.data
}

// Keep uncertain operations in memory across dialog/page changes. Never persist
// customer payloads or private payment URLs. Clear these on account changes.
const intents = new Map()
export function clearMutationIntents() {
  intents.clear()
}

export async function mutate(
  method,
  path,
  payload,
  { idempotent = true } = {},
) {
  const fingerprint = JSON.stringify([method, path, payload])
  let intent = intents.get(fingerprint)
  if (!intent) {
    intent = { key: crypto.randomUUID(), retryAt: 0 }
    intents.set(fingerprint, intent)
  }
  if (intent.retryAt > Date.now())
    throw new ApiError('Please wait before retrying this request.', {
      status: 429,
      code: 'RATE_LIMITED',
      retryAfterMs: intent.retryAt - Date.now(),
    })
  try {
    const result = await api[method](
      path,
      payload,
      idempotent ? { idempotencyKey: intent.key } : {},
    )
    if (!result || !Object.hasOwn(result, 'data'))
      throw new ApiError(
        'The save response was interrupted. Retry the same details to recover it.',
        { status: 502, code: 'INVALID_RESPONSE' },
      )
    intents.delete(fingerprint)
    return result.data
  } catch (error) {
    if (error.retryAfterMs) intent.retryAt = Date.now() + error.retryAfterMs
    if (error.status > 0 && error.status < 500 && error.status !== 429)
      intents.delete(fingerprint)
    throw error
  }
}

export function paymentDestination(value) {
  try {
    const url = new URL(value)
    if (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      (url.hostname === 'checkout.stripe.com' ||
        (url.hostname === 'invoice.stripe.com' &&
          url.pathname.startsWith('/i/')))
    )
      return url.href
  } catch {
    /* Invalid provider response must never become a redirect. */
  }
  throw new ApiError(
    'The payment link could not be verified. Refresh billing or contact support.',
    { code: 'INVALID_PAYMENT_URL' },
  )
}
