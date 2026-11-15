import { expect, test } from '@playwright/test'
import { authUrl, makeSession, mockOnboardingStatus, mockSignedIn, user } from './helpers/auth'

const application = {
  id: '507f1f77bcf86cd799439011', status: 'pending', revision: 0,
  companyName: 'Studio Goods', email: 'alex@example.com',
}

test('cross-device email confirmation resumes the saved application and shows status without another form', async ({ page }) => {
  const writes = []
  await mockOnboardingStatus(page, application)
  await page.route(`${authUrl}/auth/v1/verify`, route => {
    expect(route.request().postDataJSON()).toMatchObject({ token_hash: 'test-confirmation-hash', type: 'email' })
    return route.fulfill({ json: makeSession() })
  })
  await page.route('**/api/v1/registration/resume', route => {
    writes.push({ body: route.request().postDataJSON(), authorization: route.request().headers().authorization })
    return route.fulfill({ json: { data: { termsVersion: 'v2', application, phase: 'pending', recovery: null } } })
  })
  await page.goto('/auth/callback?token_hash=test-confirmation-hash&type=email')
  await expect(page).toHaveURL('/register')
  await expect(page.getByRole('heading', { name: 'Application received', exact: true })).toBeVisible()
  await expect(page.getByLabel('Company name')).toHaveCount(0)
  await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0)
  expect(writes).toEqual([{ body: {}, authorization: 'Bearer registration-access-token' }])
})

test('a verified application still being reconciled keeps its status and throttles resume', async ({ page }) => {
  await mockSignedIn(page)
  let resumes = 0
  await page.route('**/api/v1/registration/resume', route => {
    resumes++
    return route.fulfill({ json: { data: { application: null, termsVersion: 'v2', phase: 'awaiting_email_verification', recovery: null } } })
  })
  await page.goto('/register')
  await expect(page.getByRole('heading', { name: 'We’re checking your application', exact: true })).toBeVisible()
  await expect(page.getByLabel('Company name')).toHaveCount(0)
  await page.getByRole('button', { name: 'Refresh application status', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Please wait a minute')
  expect(resumes).toBe(1)
})

test('registration recovery stays on status when the backend requires support', async ({ page }) => {
  await mockSignedIn(page)
  await page.route('**/api/v1/registration/resume', route => route.fulfill({ json: { data: {
    application: null, termsVersion: 'v2', phase: 'awaiting_email_verification', recovery: 'retry_or_contact_support',
  } } }))
  await page.goto('/register')
  await expect(page.getByLabel('Company name')).toHaveCount(0)
  await expect(page.getByRole('status')).toContainText('Please refresh later or contact support')
})

test('resending signup confirmation observes cooldown and uses the original normalized email', async ({ page }) => {
  await page.clock.install()
  let resend
  await page.route(`${authUrl}/auth/v1/signup*`, route => route.fulfill({ json: { ...user, email_confirmed_at: null, identities: [{ provider: 'email' }] } }))
  await page.route(`${authUrl}/auth/v1/resend*`, route => {
    resend = route.request().postDataJSON()
    return route.fulfill({ json: {} })
  })
  await page.goto('/register')
  await page.getByLabel('First name').fill('Alex')
  await page.getByLabel('Email address').fill('Alex@Example.com')
  await page.getByLabel('Phone', { exact: true }).fill('4155550123')
  await page.getByLabel('Company name').fill('Studio Goods')
  await page.getByLabel('Password', { exact: true }).fill('StrongPassword1')
  await page.getByLabel('Confirm password', { exact: true }).fill('StrongPassword1')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Create account and apply', exact: true }).click()
  await expect(page.getByRole('button', { name: /Try again in/ })).toBeDisabled()
  await page.clock.fastForward(61000)
  await page.getByRole('button', { name: 'Resend confirmation email', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('If a confirmation can be sent')
  expect(resend).toMatchObject({ email: 'alex@example.com', type: 'signup' })
  await expect(page.getByRole('button', { name: /Try again in/ })).toBeDisabled()
})

test('team invitation signup creates only a sign-in, without an owner application', async ({ page }) => {
  let signup
  await page.route(`${authUrl}/auth/v1/signup*`, route => {
    signup = route.request().postDataJSON()
    return route.fulfill({ json: { ...user, email_confirmed_at: null, identities: [{ provider: 'email' }] } })
  })
  await page.goto('/team/accept#organizationId=507f1f77bcf86cd799439011&invitationId=507f1f77bcf86cd799439041&token=test-invitation')
  await page.getByRole('link', { name: 'Create an account', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Join your team.', exact: true })).toBeVisible()
  await expect(page.getByLabel('Company name')).toHaveCount(0)
  await page.getByLabel('Email address').fill('alex@example.com')
  await page.getByLabel('Password', { exact: true }).fill('StrongPassword1')
  await page.getByLabel('Confirm password', { exact: true }).fill('StrongPassword1')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('return to your invitation')
  expect(signup.data?.bookmysku_application).toBeUndefined()
})
