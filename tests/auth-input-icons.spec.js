import { expect, test } from '@playwright/test'
import { mockOnboardingStatus, mockSignedIn } from './helpers/auth'

async function checkInputIcons(page) {
  const icons = page.locator('.form-control-leading')
  expect(await icons.count()).toBeGreaterThan(0)
  for (const wrapper of await icons.all()) {
    await wrapper.scrollIntoViewIfNeeded()
    const result = await wrapper.evaluate((leading) => {
      const icon = leading.querySelector('svg')
      const input = leading.parentElement.querySelector('input')
      const bounds = icon.getBoundingClientRect()
      const leadingBounds = leading.getBoundingClientRect()
      const inputBounds = input.getBoundingClientRect()
      const pointerEvents = getComputedStyle(leading).pointerEvents
      // Enabling hit testing does not alter painting; it reveals whether the
      // input's backdrop-filter layer actually covers this decorative icon.
      const original = leading.style.pointerEvents
      leading.style.pointerEvents = 'auto'
      const top = document.elementFromPoint(
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2,
      )
      const onTop = leading.contains(top)
      leading.style.pointerEvents = original
      const channels = (value) =>
        (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number)
      const luminance = (rgb) =>
        rgb
          .map((value) => value / 255)
          .map((value) =>
            value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
          )
          .reduce(
            (sum, value, index) =>
              sum + value * [0.2126, 0.7152, 0.0722][index],
            0,
          )
      const foreground = luminance(channels(getComputedStyle(icon).stroke))
      const background = luminance(
        channels(getComputedStyle(input).backgroundColor),
      )
      return {
        field: input.name,
        onTop,
        pointerEvents,
        width: bounds.width,
        height: bounds.height,
        left: bounds.left - inputBounds.left,
        right: inputBounds.right - bounds.right,
        textGap:
          inputBounds.left +
          parseFloat(getComputedStyle(input).paddingLeft) -
          leadingBounds.right,
        contrast:
          (Math.max(foreground, background) + 0.05) /
          (Math.min(foreground, background) + 0.05),
      }
    })
    expect(
      result.onTop,
      `${result.field}: icon must paint above the input`,
    ).toBe(true)
    expect(result.pointerEvents).toBe('none')
    expect(result.width).toBeGreaterThanOrEqual(16)
    expect(result.height).toBeGreaterThanOrEqual(16)
    expect(result.left).toBeGreaterThan(0)
    expect(result.right).toBeGreaterThan(0)
    expect(result.textGap).toBeGreaterThanOrEqual(4)
    expect(
      result.contrast,
      `${result.field}: icon contrast`,
    ).toBeGreaterThanOrEqual(3)
  }
}

for (const theme of ['light', 'dark']) {
  for (const width of [375, 1280]) {
    test(`auth input icons paint above fields in ${theme} mode at ${width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
      await page.addInitScript(
        (value) => localStorage.setItem('theme', value),
        theme,
      )
      await page.route('https://fonts.googleapis.com/**', (route) =>
        route.abort(),
      )
      await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
      await page.goto('/login')
      await expect(
        page.getByRole('button', {
          name: `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`,
        }),
      ).toBeVisible()
      await checkInputIcons(page)
      const email = page.getByLabel('Email address', { exact: true })
      await email.click({ position: { x: 20, y: 20 } })
      await expect(email).toBeFocused()
      await email.fill('alex@example.com')
      await page
        .getByRole('button', { name: 'Show password', exact: true })
        .click()
      await expect(
        page.getByLabel('Password', { exact: true }),
      ).toHaveAttribute('type', 'text')
      await checkInputIcons(page)
      await page.screenshot({
        path: testInfo.outputPath('login-input-icons.png'),
        fullPage: true,
      })

      await page.goto('/register')
      await expect(
        page.getByLabel('Confirm password', { exact: true }),
      ).toBeVisible()
      await checkInputIcons(page)
      await page.screenshot({
        path: testInfo.outputPath('signup-input-icons.png'),
        fullPage: true,
      })

      await mockSignedIn(page)
      await mockOnboardingStatus(page)
      await page.goto('/register')
      await expect(
        page.getByLabel('Company name', { exact: true }),
      ).toBeVisible()
      expect(
        await page.locator('.form-control-leading').count(),
      ).toBeGreaterThanOrEqual(4)
      await checkInputIcons(page)
      await page.screenshot({
        path: testInfo.outputPath('company-input-icons.png'),
        fullPage: true,
      })
    })
  }
}
