import { createClient } from '@supabase/supabase-js'
import { ApiError, setAccessTokenProvider } from './api'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const authConfigured = Boolean(url && publishableKey?.startsWith('sb_publishable_'))
let client
let refreshInFlight
let callbackExchange

export function getAuthClient() {
  if (!authConfigured) throw new Error('Sign-in is not configured. Please contact support.')
  client ??= createClient(url, publishableKey, {
    auth: {
      flowType: 'pkce',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  })
  return client
}

async function currentAccessToken() {
  if (!authConfigured) return null
  const { data, error } = await getAuthClient().auth.getSession()
  if (error) throw new ApiError('Your session could not be loaded. Please sign in again.', { status: 401, code: 'UNAUTHENTICATED' })
  return data.session?.access_token ?? null
}

async function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = getAuthClient().auth.refreshSession()
      .then(({ data, error }) => error ? null : data.session?.access_token ?? null)
      .catch(() => null)
      .finally(() => { refreshInFlight = null })
  }
  return refreshInFlight
}

setAccessTokenProvider(currentAccessToken, refreshAccessToken)

// React StrictMode must not redeem the same one-use PKCE code twice.
export function exchangeAuthCode(code, options) {
  const flowId = options?.flowId ?? null
  if (callbackExchange?.code !== code || callbackExchange?.flowId !== flowId) {
    callbackExchange = {
      code,
      flowId,
      promise: getAuthClient().auth.exchangeCodeForSession(code, options),
    }
  }
  return callbackExchange.promise
}
