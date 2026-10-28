export const authUrl = 'https://registration-test.supabase.co'
export const storageKey = 'sb-registration-test-auth-token'
export const user = {
  id: '2c0987d9-548d-4159-ac8c-774cde9be9f4',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'alex@example.com',
  email_confirmed_at: '2026-10-18T00:00:00Z',
  user_metadata: {},
  app_metadata: { provider: 'email', providers: ['email'] },
}

export function makeSession(token = 'registration-access-token', sessionUser = user) {
  return { access_token: token, refresh_token: 'registration-refresh-token', expires_in: 900, expires_at: Math.floor(Date.now() / 1000) + 900, token_type: 'bearer', user: sessionUser }
}

export async function mockSignedIn(page, session = makeSession()) {
  await page.addInitScript(({ storageKey, session }) => {
    window.localStorage.setItem(storageKey, JSON.stringify(session))
  }, { storageKey, session })
}

export async function mockOnboardingStatus(page, application = null, termsVersion = 'v2') {
  await page.route('**/api/v1/admin/me', route => route.fulfill({ status: 403, json: { error: { code: 'PLATFORM_ACCESS_REQUIRED', message: 'Platform administrator access is required' } } }))
  await page.route('**/api/v1/onboarding/journey', route => route.fulfill({ json: { data: {
    nextAction: application?.status === 'approved' ? 'complete_company' : application?.status === 'pending' ? 'await_review' : application?.status === 'rejected' ? 'correct_application' : 'choose_onboarding',
    invitations: { items: [] },
  } } }))
  await page.route('**/api/v1/onboarding/me', route => route.fulfill({ json: { data: { application, termsVersion, phase: application?.status ?? 'not_submitted', organization: null } } }))
}
