import { expect, test } from '@playwright/test'
import { authUrl, makeSession, mockSignedIn, user } from './helpers/auth'

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
  await page.route(`${authUrl}/auth/v1/token?grant_type=password`, (route) =>
    route.fulfill({ json: makeSession() }),
  )
})

async function signIn(page) {
  await page
    .getByRole('textbox', { name: 'Email address', exact: true })
    .fill(user.email)
  await page.getByLabel('Password', { exact: true }).fill('StrongPassword1')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}

test('a successful superadmin login opens administration without owner onboarding', async ({
  page,
}) => {
  let journeyReads = 0
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/onboarding/journey')) journeyReads++
    return route.fulfill({
      json: {
        data: path.endsWith('/admin/me')
          ? { role: 'super_admin' }
          : { items: [] },
      },
    })
  })
  await page.goto('/login')
  await signIn(page)
  await expect(page).toHaveURL('/admin')
  await expect(
    page.getByRole('navigation', { name: 'Platform administration' }),
  ).toBeVisible()
  expect(journeyReads).toBe(0)
})

test('a signed-in member typing the login URL returns to the workspace on navigation and reload', async ({ page }) => {
  await mockSignedIn(page)
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/admin/me'))
      return route.fulfill({
        status: 403,
        json: { error: { code: 'PLATFORM_ACCESS_REQUIRED', message: 'Platform administrator access is required.' } },
      })
    return route.fulfill({
      json: {
        data: path.endsWith('/onboarding/journey')
          ? { nextAction: 'open_workspace', invitations: { items: [] } }
          : { items: [], next: null },
      },
    })
  })
  await page.goto('/app')
  await expect(page.getByRole('link', { name: 'Continue workspace setup' })).toBeVisible()
  await page.goto('/login')
  await expect(page).toHaveURL('/app')
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('link', { name: 'Continue workspace setup' })).toBeVisible()
  await expect(page).toHaveURL('/app')
})

test('login waits for a stored session to refresh and sends an existing admin to administration', async ({ page }) => {
  await mockSignedIn(page, { ...makeSession(), expires_at: Math.floor(Date.now() / 1000) - 60 })
  let releaseRefresh
  let startedRefresh
  const refreshing = new Promise(resolve => { startedRefresh = resolve })
  const released = new Promise(resolve => { releaseRefresh = resolve })
  await page.route(`${authUrl}/auth/v1/token?grant_type=refresh_token`, async route => {
    startedRefresh()
    await released
    await route.fulfill({ json: makeSession('refreshed-token') })
  })
  await page.route('**/api/v1/**', route => route.fulfill({
    json: {
      data: new URL(route.request().url()).pathname.endsWith('/admin/me')
        ? { role: 'super_admin' }
        : { items: [] },
    },
  }))
  await page.goto('/login')
  await refreshing
  try {
    await expect(page.getByRole('status')).toContainText('Checking your session')
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toHaveCount(0)
  } finally {
    releaseRefresh()
  }
  await expect(page).toHaveURL('/admin')
  await expect(page.getByRole('navigation', { name: 'Platform administration' })).toBeVisible()
})

test('an unconfirmed session visiting login continues email verification', async ({ page }) => {
  await mockSignedIn(page, makeSession('unconfirmed-token', { ...user, email_confirmed_at: null }))
  await page.goto('/login')
  await expect(page).toHaveURL('/register')
  await expect(page.getByRole('heading', { name: 'Confirm your email' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toHaveCount(0)
})

test('an allowlisted admin needing MFA reaches the challenge before administration', async ({
  page,
}) => {
  await mockSignedIn(page)
  await page.route(`${authUrl}/auth/v1/user`, (route) =>
    route.fulfill({ json: { ...user, factors: [] } }),
  )
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({
      status: 403,
      json: {
        error: {
          code: 'ADMIN_MFA_REQUIRED',
          message: 'A recent authenticator challenge is required.',
        },
      },
    }),
  )
  await page.goto('/continue')
  await expect(page).toHaveURL('/admin')
  await expect(
    page.getByRole('heading', { name: 'Confirm with your authenticator' }),
  ).toBeVisible()
  await expect(
    page.getByRole('navigation', { name: 'Platform administration' }),
  ).toHaveCount(0)
})

test('a regular member follows the server journey despite browser admin metadata', async ({
  page,
}) => {
  await mockSignedIn(
    page,
    makeSession('member-token', {
      ...user,
      user_metadata: { role: 'super_admin', isSuperAdmin: true },
    }),
  )
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/admin/me'))
      return route.fulfill({
        status: 403,
        json: {
          error: {
            code: 'PLATFORM_ACCESS_REQUIRED',
            message: 'Platform administrator access is required.',
          },
        },
      })
    return route.fulfill({
      json: {
        data: path.endsWith('/onboarding/journey')
          ? { nextAction: 'open_workspace', invitations: { items: [] } }
          : { items: [], next: null },
      },
    })
  })
  await page.goto('/continue')
  await expect(page).toHaveURL('/app')
  await expect(
    page.getByRole('link', { name: 'Continue workspace setup' }),
  ).toBeVisible()
  await expect(
    page.getByRole('navigation', { name: 'Platform administration' }),
  ).toHaveCount(0)
})

test('an access-check outage preserves a retry instead of starting onboarding', async ({
  page,
}) => {
  await mockSignedIn(page)
  let recovered = false
  let journeyReads = 0
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/onboarding/journey')) journeyReads++
    if (!recovered)
      return route.fulfill({
        status: 503,
        json: {
          error: {
            code: 'IDENTITY_PROVIDER_UNAVAILABLE',
            message: 'Account verification is temporarily unavailable.',
          },
        },
      })
    return route.fulfill({ json: { data: { role: 'super_admin' } } })
  })
  await page.goto('/continue')
  await expect(page.getByRole('alert')).toContainText(
    'Account verification is temporarily unavailable.',
  )
  await expect(page).toHaveURL('/continue')
  expect(journeyReads).toBe(0)
  recovered = true
  await page.getByRole('button', { name: 'Reload latest data' }).click()
  await expect(page).toHaveURL('/admin')
})

test('an invitation sign-in keeps its recipient flow ahead of admin discovery', async ({
  page,
}) => {
  let discoveryReads = 0
  await page.route('**/api/v1/**', (route) => {
    discoveryReads++
    return route.fulfill({ json: { data: { role: 'super_admin' } } })
  })
  await page.goto(
    '/team/accept#organizationId=507f1f77bcf86cd799439011&invitationId=507f1f77bcf86cd799439041&token=invitation-secret',
  )
  await signIn(page)
  await expect(page).toHaveURL('/team/accept')
  await expect(
    page.getByRole('button', { name: 'Accept invitation' }),
  ).toBeVisible()
  expect(discoveryReads).toBe(0)
})
