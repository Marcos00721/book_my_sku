import { expect, test } from '@playwright/test'
import { authUrl, makeSession, mockOnboardingStatus, mockSignedIn, storageKey, user } from './helpers/auth'

const application = { id: '507f1f77bcf86cd799439011', status: 'pending', revision: 0, firstName: 'Alex', lastName: 'Morgan', contactNumber: '+14155550123', companyWebsite: 'https://example.com', companyName: 'Studio Goods', email: 'alex@example.com' }

async function openRegistration(page, existing = null) {
  await mockSignedIn(page)
  await mockOnboardingStatus(page, existing)
  await page.goto('/register')
  if (!existing) await expect(page.getByRole('checkbox', { name: /v2/ })).toBeVisible()
}

async function fillRegistration(page) {
  await page.getByLabel('First name').fill('Alex')
  await page.getByLabel('Last name').fill('Morgan')
  await page.getByLabel('Phone number').fill('4155550123')
  await page.getByLabel('Company name').fill('Studio Goods')
  await page.getByLabel('Company website').fill('example.com')
  await page.getByRole('checkbox').check()
}

async function submit(page) {
  await page.getByRole('button', { name: 'Submit application', exact: true }).click()
}

test('signup waits for email confirmation before making any backend application request', async ({ page }) => {
  const backendRequests = []
  let signup
  page.on('request', request => { if (request.url().includes('/api/v1/')) backendRequests.push(request.url()) })
  await page.route(`${authUrl}/auth/v1/signup*`, route => {
    signup = { body: route.request().postDataJSON(), url: route.request().url() }
    return route.fulfill({ json: { ...user, email_confirmed_at: null, identities: [{ provider: 'email' }] } })
  })
  await page.goto('/register')
  await page.getByLabel('Email address').fill('Alex@Example.com')
  await page.getByLabel('Password', { exact: true }).fill('StrongPassword1')
  await page.getByLabel('Confirm password', { exact: true }).fill('DifferentPassword1')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByText('Your passwords do not match.')).toBeVisible()
  await page.getByLabel('Confirm password', { exact: true }).fill('StrongPassword1')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
  expect(signup.body.email).toBe('alex@example.com')
  expect(signup.body.password).toBe('StrongPassword1')
  expect(signup.body.code_challenge).toBeTruthy()
  expect(new URL(signup.url).searchParams.get('redirect_to')).toBe('http://127.0.0.1:5173/auth/callback')
  expect(backendRequests).toHaveLength(0)
})

test('registration validates six company fields and locks the verified email', async ({ page }) => {
  await openRegistration(page)
  await expect(page.getByLabel('Email address')).toHaveValue('alex@example.com')
  await expect(page.getByLabel('Email address')).not.toBeEditable()
  for (const label of ['First name', 'Last name', 'Phone number', 'Company name', 'Company website']) {
    await expect(page.getByLabel(label, { exact: true })).toBeEditable()
  }
  const phone = page.getByLabel('Phone number')
  await phone.fill('+1 (415) 555-0123')
  await expect(phone).toHaveValue('415-555-0123')
  await phone.fill('14155550123')
  await expect(phone).toHaveValue('415-555-0123')
  await submit(page)
  await expect(page.getByLabel('First name')).toBeFocused()
  await expect(page.getByLabel('Company website')).toHaveAttribute('aria-invalid', 'true')
  await phone.fill('415555012')
  await phone.press('Tab')
  await expect(page.getByText('Enter a 10-digit US phone number.')).toBeVisible()
  await expect(page.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0)
})

test('registration sends only documented fields with a bearer token, current terms and UUID', async ({ page }) => {
  let write
  let release
  const gate = new Promise(resolve => { release = resolve })
  await page.route('**/api/v1/onboarding', async route => {
    write = { body: route.request().postDataJSON(), headers: route.request().headers() }
    await gate
    await route.fulfill({ status: 202, json: { data: application } })
  })
  await openRegistration(page)
  await fillRegistration(page)
  await submit(page)
  await expect(page.getByRole('button', { name: 'Submitting application…' })).toBeDisabled()
  await expect(page.getByLabel('Company name')).toBeDisabled()
  release()
  await expect(page.getByRole('heading', { name: 'Application received', exact: true })).toBeVisible()
  expect(write.body).toEqual({ firstName: 'Alex', lastName: 'Morgan', email: 'alex@example.com', contactNumber: '+14155550123', companyName: 'Studio Goods', companyWebsite: 'https://example.com', termsAccepted: true, termsVersion: 'v2' })
  expect(write.headers.authorization).toBe('Bearer registration-access-token')
  expect(write.headers['idempotency-key']).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/)
})

test('uncertain registration responses preserve the draft and original UUID', async ({ page }) => {
  const writes = []
  await page.route('**/api/v1/onboarding', async route => {
    writes.push({ body: route.request().postDataJSON(), key: route.request().headers()['idempotency-key'] })
    if (writes.length === 1) return route.abort('failed')
    await route.fulfill({ status: 202, json: { data: application } })
  })
  await openRegistration(page)
  await fillRegistration(page)
  await submit(page)
  await expect(page.getByText('The connection was interrupted. Please retry your request.')).toBeVisible()
  await expect(page.getByLabel('Company name')).toHaveValue('Studio Goods')
  await submit(page)
  await expect(page.getByText('Your application is pending review.')).toBeVisible()
  expect(writes).toHaveLength(2)
  expect(writes[1]).toEqual(writes[0])
})

test('changed terms require fresh acceptance and use the newly loaded version', async ({ page }) => {
  const writes = []
  await page.route('**/api/v1/onboarding', async route => {
    writes.push(route.request().postDataJSON())
    if (writes.length === 1) {
      await mockOnboardingStatus(page, null, 'v3')
      return route.fulfill({ status: 409, json: { error: { code: 'TERMS_UPDATED', message: 'Review the current registration terms.' } } })
    }
    return route.fulfill({ status: 202, json: { data: application } })
  })
  await openRegistration(page)
  await fillRegistration(page)
  await submit(page)
  await expect(page.getByRole('checkbox', { name: /v3/ })).not.toBeChecked()
  expect(writes).toHaveLength(1)
  await page.getByRole('checkbox').check()
  await submit(page)
  await expect(page.getByText('Your application is pending review.')).toBeVisible()
  expect(writes[1].termsVersion).toBe('v3')
})

test('backend field errors preserve values and show the support reference', async ({ page }) => {
  await page.route('**/api/v1/onboarding', route => route.fulfill({ status: 400, headers: { 'X-Request-Id': 'registration-reference' }, json: { error: { code: 'INVALID_REQUEST', message: 'Please check the highlighted fields', fields: [{ field: 'companyWebsite', message: 'Enter your public company website.' }] } } }))
  await openRegistration(page)
  await fillRegistration(page)
  await submit(page)
  await expect(page.getByText('Enter your public company website.')).toBeVisible()
  await expect(page.getByText('Support reference: registration-reference')).toBeVisible()
  await expect(page.getByLabel('Company name')).toHaveValue('Studio Goods')
})

test('a refresh displays an existing pending application without allowing duplicate submission', async ({ page }) => {
  await openRegistration(page, application)
  await expect(page.getByText('Your application is pending review.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Submit application', exact: true })).toHaveCount(0)
})

test('rejected applications can be corrected using the latest revision', async ({ page }) => {
  let write
  await openRegistration(page, { ...application, status: 'rejected', revision: 4, reason: 'Please correct the company name.' })
  await expect(page.getByText('Review feedback: Please correct the company name.')).toBeVisible()
  await page.getByRole('button', { name: 'Correct application' }).click()
  await expect(page.getByLabel('First name')).toHaveValue('Alex')
  await expect(page.getByLabel('Phone number')).toHaveValue('415-555-0123')
  await page.route('**/api/v1/onboarding/me', route => {
    write = { method: route.request().method(), body: route.request().postDataJSON() }
    return route.fulfill({ json: { data: { ...application, revision: 5 } } })
  })
  await page.getByLabel('Company name').fill('Studio Goods Updated')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Resubmit application' }).click()
  await expect(page.getByText('Your application is pending review.')).toBeVisible()
  expect(write.method).toBe('PUT')
  expect(write.body.expectedRevision).toBe(4)
  expect(write.body.companyName).toBe('Studio Goods Updated')
})

test('401 refreshes the session once and replays the identical operation', async ({ page }) => {
  let refreshes = 0
  const writes = []
  await page.route(`${authUrl}/auth/v1/token?grant_type=refresh_token`, route => {
    refreshes++
    return route.fulfill({ json: makeSession('refreshed-access-token') })
  })
  await page.route('**/api/v1/onboarding', route => {
    writes.push({ body: route.request().postDataJSON(), headers: route.request().headers() })
    return writes.length === 1 ? route.fulfill({ status: 401, json: { error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } } }) : route.fulfill({ status: 202, json: { data: application } })
  })
  await openRegistration(page)
  await fillRegistration(page)
  await submit(page)
  await expect(page.getByText('Your application is pending review.')).toBeVisible()
  expect(refreshes).toBe(1)
  expect(writes).toHaveLength(2)
  expect(writes[1].body).toEqual(writes[0].body)
  expect(writes[1].headers['idempotency-key']).toBe(writes[0].headers['idempotency-key'])
  expect(writes[1].headers.authorization).toBe('Bearer refreshed-access-token')
})

test('a repeated 401 stops after one refresh and preserves the application form', async ({ page }) => {
  let refreshes = 0
  let writes = 0
  await page.route(`${authUrl}/auth/v1/token?grant_type=refresh_token`, route => {
    refreshes++
    return route.fulfill({ json: makeSession('still-rejected-token') })
  })
  await page.route('**/api/v1/onboarding', route => {
    writes++
    return route.fulfill({ status: 401, json: { error: { code: 'UNAUTHENTICATED', message: 'Please sign in again' } } })
  })
  await openRegistration(page)
  await fillRegistration(page)
  await submit(page)
  await expect(page.getByRole('link', { name: 'Sign in again to continue' })).toBeVisible()
  await expect(page.getByLabel('Company name')).toHaveValue('Studio Goods')
  expect(refreshes).toBe(1)
  expect(writes).toBe(2)
})

test('confirmation callback redeems the PKCE code once and removes it from the URL', async ({ page }) => {
  let exchanges = 0
  await page.addInitScript(({ storageKey }) => localStorage.setItem(`${storageKey}-code-verifier`, JSON.stringify('test-pkce-verifier')), { storageKey })
  await page.route(`${authUrl}/auth/v1/token?grant_type=pkce`, route => {
    exchanges++
    expect(route.request().postDataJSON().auth_code).toBe('confirmation-code')
    return route.fulfill({ json: makeSession() })
  })
  await mockOnboardingStatus(page)
  await page.goto('/auth/callback?code=confirmation-code')
  await expect(page).toHaveURL('/register')
  await expect(page.getByRole('checkbox', { name: /v2/ })).toBeVisible()
  expect(exchanges).toBe(1)
})

test('invalid confirmation links show a recovery message and clear URL parameters', async ({ page }) => {
  await page.goto('/auth/callback?error=access_denied&error_description=expired')
  await expect(page.getByRole('alert')).toContainText('invalid or has expired')
  await expect(page).toHaveURL('/auth/callback')
})

test('login signs in through Supabase and resumes the company application', async ({ page }) => {
  await page.route(`${authUrl}/auth/v1/token?grant_type=password`, route => route.fulfill({ json: makeSession() }))
  await mockOnboardingStatus(page)
  await page.goto('/login')
  await page.getByLabel('Email address').fill('alex@example.com')
  await page.getByLabel('Password', { exact: true }).fill('StrongPassword1')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL('/register')
  await expect(page.getByRole('checkbox', { name: /v2/ })).toBeVisible()
})
