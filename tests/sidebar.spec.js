import { expect, test } from '@playwright/test'
import { mockSignedIn } from './helpers/auth'

async function mockWorkspace(page, { mode = 'light', owner = true } = {}) {
  await mockSignedIn(page)
  await page.addInitScript((theme) => localStorage.setItem('theme', theme), mode)
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname
    let data = { items: [], next: null }
    if (path.endsWith('/organizations')) data = { items: [{ id: 'studio', name: 'Acme Studio', status: 'active' }], next: null }
    else if (path.endsWith('/permissions')) data = {
      owner,
      role: owner ? null : { name: 'Client viewer' },
      grants: (owner ? ['clients.view', 'suppliers.view', 'products.view', 'master_data.view'] : ['clients.view'])
        .map((key) => ({ key, scope: key.endsWith('.add') ? 'none' : 'all' })),
    }
    else if (path.endsWith('/access')) data = { writesAllowed: true, state: 'normal' }
    return route.fulfill({ json: { data } })
  })
}

for (const mode of ['light', 'dark']) {
  test(`desktop sidebar collapses, persists and finds permitted pages in ${mode}`, async ({ page }, testInfo) => {
    await mockWorkspace(page, { mode })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/app')
    const sidebar = page.getByRole('complementary', { name: 'Workspace sidebar' })
    const nav = sidebar.getByRole('navigation')
    await expect(nav.getByRole('link', { name: 'Overview', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(nav.getByRole('link', { name: 'Decoration matrices', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Acme Studio', exact: true })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`sidebar-${mode}.png`), fullPage: true })
    await sidebar.getByRole('button', { name: 'Collapse sidebar' }).click()
    await expect(sidebar).toHaveClass(/is-collapsed/)
    await expect(sidebar).toHaveCSS('width', '84px')
    await page.reload()
    await expect(sidebar).toHaveClass(/is-collapsed/)
    await expect(sidebar.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
    await nav.getByRole('link', { name: 'Clients', exact: true }).click()
    await expect(page).toHaveURL(/\/app\/clients$/)
    await expect(nav.getByRole('link', { name: 'Clients', exact: true })).toHaveAttribute('aria-current', 'page')
    await page.keyboard.press('Control+k')
    const search = sidebar.getByRole('searchbox', { name: 'Find a page' })
    await expect(search).toBeFocused()
    await expect(sidebar).not.toHaveClass(/is-collapsed/)
    await search.fill('supplier')
    await expect(nav.getByRole('link')).toHaveCount(1)
    await nav.getByRole('link', { name: 'Suppliers', exact: true }).click()
    await expect(page).toHaveURL(/\/app\/suppliers$/)
    await expect(search).toHaveValue('')
    await search.fill('unavailable-page')
    await expect(nav.getByRole('status')).toHaveText('No pages found.')
    await search.press('Escape')
    await expect(nav.getByRole('link', { name: 'Products', exact: true })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440)
  })

  test(`mobile sidebar traps focus, closes and restores focus in ${mode}`, async ({ page }, testInfo) => {
    await mockWorkspace(page, { mode })
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/app')
    const opener = page.getByRole('button', { name: 'Open navigation', exact: true })
    await opener.click()
    const drawer = page.getByRole('dialog', { name: 'Workspace navigation' })
    await expect(drawer).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`sidebar-mobile-${mode}.png`), fullPage: true })
    await page.keyboard.press('Shift+Tab')
    expect(await drawer.evaluate((element) => element.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(drawer).not.toBeVisible()
    await expect(opener).toBeFocused()
    await page.keyboard.press('Control+k')
    await expect(drawer.getByRole('searchbox')).toBeFocused()
    await drawer.getByRole('link', { name: 'Clients', exact: true }).click()
    await expect(drawer).not.toBeVisible()
    await expect(page.locator('#workspace-main')).toBeFocused()
    await opener.click()
    await page.setViewportSize({ width: 1024, height: 812 })
    await expect(drawer).not.toBeVisible()
    await expect(page.getByRole('complementary', { name: 'Workspace sidebar' })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1024)
  })
}

test('sidebar search never exposes destinations denied by workspace permissions', async ({ page }) => {
  await mockWorkspace(page, { owner: false })
  await page.goto('/app')
  const nav = page.getByRole('navigation', { name: 'Workspace navigation' })
  await expect(nav.getByRole('link')).toHaveCount(2)
  await page.getByRole('searchbox', { name: 'Find a page' }).fill('billing')
  await expect(nav.getByRole('status')).toHaveText('No pages found.')
  await expect(nav.getByRole('link', { name: 'Billing' })).toHaveCount(0)
})
