import { expect, test } from '@playwright/test'
import { mockSignedIn } from './helpers/auth'

test.beforeEach(async ({ page }) => {
  await mockSignedIn(page)
  await page.addInitScript(() => localStorage.setItem('theme', 'light'))
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({
      json: {
        data: new URL(route.request().url()).pathname.endsWith('/admin/me')
          ? { role: 'super_admin' }
          : { items: [], next: null, nextCursor: null },
      },
    }),
  )
})

test('admin sections survive reload and browser back without exposing denied navigation', async ({
  page,
}) => {
  await page.goto('/admin')
  const navigation = page.getByRole('navigation', {
    name: 'Platform administration',
  })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'A clearer view of your platform.',
  )
  await navigation
    .getByRole('link', { name: 'Applications', exact: true })
    .click()
  await expect(page.getByLabel('Review status')).toBeVisible()
  await navigation
    .getByRole('link', { name: 'Email verification', exact: true })
    .click()
  await page.reload()
  await expect(
    navigation.getByRole('link', { name: 'Email verification' }),
  ).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Email verification',
  )
  await page.goBack()
  await expect(page.getByLabel('Review status')).toBeVisible()
  await page.route('**/admin/me', (route) =>
    route.fulfill({
      status: 403,
      json: {
        error: {
          code: 'PLATFORM_ACCESS_REQUIRED',
          message: 'Platform administrator access is required',
        },
      },
    }),
  )
  await page.reload()
  await expect(page.getByRole('alert')).toContainText(
    'Platform administrator access is required',
  )
  await expect(navigation).toHaveCount(0)
})

for (const width of [390, 1440]) {
  test(`admin navigation and existing themes work at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/admin')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'A clearer view of your platform.',
    )
    for (const mode of ['light', 'dark']) {
      if (mode === 'dark')
        await page.getByRole('button', { name: 'Switch to dark mode' }).click()
      await expect(page.locator('html')).toHaveClass(
        mode === 'dark' ? /dark/ : /^(?!.*dark)/,
      )
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)
      await page.screenshot({
        path: testInfo.outputPath(`admin-${width}-${mode}.png`),
        fullPage: true,
      })
    }
    if (width < 800) {
      const opener = page.getByRole('button', { name: 'Open admin navigation' })
      await opener.click()
      const drawer = page.getByRole('dialog', { name: 'Admin navigation' })
      await expect(drawer).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(drawer).not.toBeVisible()
      await expect(opener).toBeFocused()
      await opener.click()
      await drawer
        .getByRole('link', { name: 'Applications', exact: true })
        .click()
      await expect(drawer).not.toBeVisible()
      await expect(page.getByLabel('Review status')).toBeVisible()
      await expect(page.locator('#admin-main')).toBeFocused()
    }
  })
}
