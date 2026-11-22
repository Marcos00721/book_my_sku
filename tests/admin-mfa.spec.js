import { expect, test } from '@playwright/test'
import { authUrl, mockSignedIn, user } from './helpers/auth'

const factorId = '9d01b2c4-d42d-4c0c-ae1e-2aa224bc97e4'
const factor = { id: factorId, factor_type: 'totp', status: 'verified', friendly_name: 'My authenticator' }

test.beforeEach(async ({ page }) => {
  await mockSignedIn(page)
  await page.addInitScript(() => localStorage.setItem('theme', 'light'))
  await page.route('https://fonts.googleapis.com/**', route => route.abort())
  await page.route('https://fonts.gstatic.com/**', route => route.abort())
  await page.route('**/api/v1/**', route => route.fulfill({
    status: 403,
    json: { error: { code: 'ADMIN_MFA_REQUIRED', message: 'A recent authenticator challenge is required.' } },
  }))
  await page.route(`${authUrl}/auth/v1/user`, route => route.fulfill({ json: { ...user, factors: [factor] } }))
})

for (const width of [375, 1440]) {
  test(`verification is usable in both themes at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/admin')
    const input = page.getByLabel('Authenticator code')
    const submit = page.getByRole('button', { name: 'Verify and continue' })
    await expect(input).toBeVisible()
    await expect(submit).toBeDisabled()
    await input.fill('12ab34')
    await expect(input).toHaveValue('1234')
    await expect(submit).toBeDisabled()
    await input.fill('123456')
    await expect(submit).toBeEnabled()
    for (const mode of ['light', 'dark']) {
      if (mode === 'dark') await page.getByRole('button', { name: 'Switch to dark mode' }).click()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      const card = await page.locator('.mfa-card').boundingBox()
      expect(card.width).toBeLessThanOrEqual(512)
      const field = await input.boundingBox()
      const button = await submit.boundingBox()
      expect(button.y - field.y - field.height).toBeGreaterThanOrEqual(24)
      await page.screenshot({ path: testInfo.outputPath(`verification-${width}-${mode}.png`), fullPage: true })
    }
  })
}

test('existing factors finish loading before offering authenticator setup', async ({ page }) => {
  let release
  const ready = new Promise(resolve => { release = resolve })
  await page.route(`${authUrl}/auth/v1/user`, async route => {
    await ready
    await route.fulfill({ json: { ...user, factors: [] } })
  })
  await page.goto('/admin')
  try {
    await expect(page.getByRole('status')).toContainText('Loading your authenticators')
    await expect(page.getByRole('button', { name: 'Set up authenticator' })).toHaveCount(0)
  } finally {
    release()
  }
  await expect(page.getByRole('button', { name: 'Set up authenticator' })).toBeVisible()
})

test('a rejected code restores the form so the admin can retry', async ({ page }) => {
  await page.route(`${authUrl}/auth/v1/factors/${factorId}/challenge`, route => route.fulfill({
    json: { id: 'challenge-id', expires_at: Math.floor(Date.now() / 1000) + 300 },
  }))
  let release
  const ready = new Promise(resolve => { release = resolve })
  await page.route(`${authUrl}/auth/v1/factors/${factorId}/verify`, async route => {
    await ready
    await route.fulfill({ status: 422, json: { message: 'That code has expired. Try the latest code.', code: 'mfa_verification_failed' } })
  })
  await page.goto('/admin')
  const input = page.getByLabel('Authenticator code')
  await input.fill('123456')
  await page.getByRole('button', { name: 'Verify and continue' }).click()
  try {
    await expect(page.getByRole('button', { name: 'Verifying…' })).toBeDisabled()
    await expect(input).toBeDisabled()
  } finally {
    release()
  }
  await expect(page.getByRole('alert')).toContainText('That code has expired')
  await expect(input).toBeEnabled()
  await input.fill('654321')
  await expect(page.getByRole('button', { name: 'Verify and continue' })).toBeEnabled()
})
