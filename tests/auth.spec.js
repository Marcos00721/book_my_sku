import { expect, test } from '@playwright/test'

test('login validates accessibly and shows provider errors without logging credentials', async ({ page }) => {
  await page.route('https://registration-test.supabase.co/auth/v1/token?grant_type=password', route => route.fulfill({ status: 400, json: { code: 'invalid_credentials', msg: 'Invalid login credentials' } }))
  const submittedValues = []
  page.on('console', async (message) => {
    if (message.type() === 'log') {
      submittedValues.push(await message.args()[0]?.jsonValue())
    }
  })
  await page.goto('/login')
  const email = page.getByLabel('Email address')
  const password = page.getByLabel('Password', { exact: true })
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(email).toBeFocused()
  await expect(email).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Enter your email address.')).toBeVisible()
  const descriptionId = await email.getAttribute('aria-describedby')
  expect(descriptionId).toBeTruthy()
  await expect(page.locator(`[id="${descriptionId}"]`)).toHaveText('Enter your email address.')
  await email.fill('alex@example.com')
  await password.fill('ExistingPassword1')
  await page.getByRole('button', { name: 'Show password', exact: true }).click()
  await expect(password).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Hide password', exact: true }).click()
  await expect(password).toHaveAttribute('type', 'password')
  await expect(email).toHaveAttribute('aria-invalid', 'false')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Invalid login credentials')
  expect(submittedValues).toHaveLength(0)
})

for (const width of [320, 375, 768, 1024, 1440]) {
  for (const path of ['/login', '/register']) {
    test(`${path} fits a ${width}px viewport`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      if (width === 320 || width === 1440) {
        await expect(page.getByRole('heading', { level: 1 }).locator('xpath=../..')).toHaveCSS('opacity', '1')
        await expect(page.locator('input').last().locator('xpath=../..')).toHaveCSS('opacity', '1')
        await page.screenshot({ path: testInfo.outputPath('page.png'), fullPage: true })
      }
      await page.getByRole('button', { name: path === '/login' ? 'Sign in' : 'Create account', exact: true }).click()
      await expect(page.getByLabel('Email address')).toHaveAttribute('aria-invalid', 'true')
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    })
  }
}

test('reduced motion leaves fields visible and skips entrance and shake movement', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/login')
  const form = page.getByRole('form', { name: 'Welcome back.' })
  const email = page.getByLabel('Email address')
  await expect(email).toBeVisible()
  await expect(email.locator('xpath=../..')).toHaveCSS('opacity', '1')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(form).toHaveCSS('transform', 'none')
})

test('auth links navigate without leaving the application', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL('/login')
  await page.getByRole('link', { name: 'Create an account' }).click()
  await expect(page).toHaveURL('/register')
  await page.getByRole('link', { name: 'Sign in', exact: true }).click()
  await page.getByRole('link', { name: 'Forgot password?' }).click()
  await expect(page).toHaveURL('/forgot-password')
  await page.getByRole('link', { name: 'Back to sign in' }).click()
  await expect(page).toHaveURL('/login')
})
