import { expect, test } from '@playwright/test'
import { mockSignedIn } from './helpers/auth'
import { contrastRatio } from './helpers/contrast'

const org = '507f1f77bcf86cd799439011'
const productId = '507f1f77bcf86cd799439033'
const product = {
  id: productId, name: 'Cotton polo', productCode: 'PRD-000001',
  supplierId: '507f1f77bcf86cd799439022', supplierItemCode: 'POLO-01',
  supplier: { name: 'Acme Supply', eligible: true }, status: 'draft', revision: 2,
  configuration: { mode: 'unresolved', dimensions: [] },
  readiness: { activationBlockers: [], restoreBlockers: [] },
}

async function mockWorkspace(page, mode) {
  await mockSignedIn(page)
  await page.addInitScript((theme) => localStorage.setItem('theme', theme), mode)
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '')
    let data = { items: [], next: null }
    if (path === '/organizations') data = { items: [{ id: org, name: 'Acme Studio', status: 'active' }], next: null }
    else if (path.endsWith('/permissions')) data = {
      owner: true,
      grants: [
        'clients.view', 'clients.add', 'clients.edit', 'contacts.view',
        'suppliers.view', 'suppliers.add', 'suppliers.edit', 'suppliers.view',
        'products.view', 'products.add', 'products.edit', 'products.view',
        'products.edit', 'products.view',
        'master_data.view',
      ].map((key) => ({ key, scope: key.endsWith('add') ? 'none' : 'all' })),
    }
    else if (path.endsWith('/access')) data = { writesAllowed: true, state: 'normal' }
    else if (path === `/organizations/${org}/products`) data = { items: [product], next: null }
    else if (path === `/organizations/${org}/products/${productId}`) data = product
    else if (path.endsWith('/categories')) data = { items: [] }
    else if (path === '/onboarding/me') data = { application: null }
    return route.fulfill({ json: { data } })
  })
}

for (const mode of ['light', 'dark']) {
  for (const width of [375, 1440]) {
    test(`glass surfaces remain readable and usable in ${mode} at ${width}px`, async ({ page }, testInfo) => {
      test.setTimeout(60000)
      await mockWorkspace(page, mode)
      await page.setViewportSize({ width, height: 1000 })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      for (const path of ['', '/clients', '/suppliers', '/products', '/master-data', '/team', '/roles', '/billing', '/decoration-matrices']) {
        await page.goto(`/app${path}`)
        await expect(page.locator('main h1')).toBeVisible()
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
        expect(await page.locator('main').evaluate((node) => getComputedStyle(node).fontFamily)).toContain('Inter')
        await expect(page.locator('.workspace-shell')).toHaveCSS('background-image', /radial-gradient/)
        await expect(page.locator('main')).toHaveCSS('background-image', 'none')
      }
      await page.goto('/app/products')
      const create = page.locator('.page-heading').getByRole('button', { name: 'Create', exact: true })
      expect(await contrastRatio(create)).toBeGreaterThanOrEqual(4.5)
      await expect(create).toHaveCSS('backdrop-filter', 'none')
      await expect(page.locator('.table-scroll')).toHaveCSS('backdrop-filter', 'none')
      await page.screenshot({ path: testInfo.outputPath('products.png'), fullPage: true })
      await create.click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      const name = dialog.getByRole('textbox', { name: 'Product name', exact: true })
      await name.focus()
      await expect(name).toBeFocused()
      await expect(name).toHaveCSS('backdrop-filter', 'none')
      expect(await contrastRatio(name)).toBeGreaterThanOrEqual(4.5)
      await page.screenshot({ path: testInfo.outputPath('product-dialog.png'), fullPage: true })
      await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click()
      await page.goto(`/app/products/${productId}`)
      for (const label of ['Variants', 'Images', 'Pricing', 'Activity', 'Details']) {
        const tab = page.getByRole('tab', { name: label, exact: true })
        await tab.click()
        await expect(tab).toHaveAttribute('aria-selected', 'true')
        expect(await contrastRatio(tab)).toBeGreaterThanOrEqual(4.5)
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      }
      await page.getByRole('tab', { name: 'Pricing', exact: true }).click()
      await page.screenshot({ path: testInfo.outputPath('product-pricing.png'), fullPage: true })
      expect(errors).toEqual([])
    })
  }
}

test('glass has an opaque base when backdrop filtering is unavailable', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading')).toBeVisible()
  // Disable enhancement rules to exercise the base styles shipped to older browsers.
  await page.evaluate(() => {
    const disableEnhancements = (sheet) => {
      for (let index = sheet.cssRules.length - 1; index >= 0; index--) {
        const rule = sheet.cssRules[index]
        if (rule instanceof CSSSupportsRule && rule.conditionText.includes('backdrop-filter')) sheet.deleteRule(index)
      }
    }
    for (const sheet of document.styleSheets) {
      if (!sheet.href || new URL(sheet.href).origin === location.origin) disableEnhancements(sheet)
    }
  })
  await expect(page.locator('.auth-form')).toHaveCSS('backdrop-filter', 'none')
  const alpha = await page.locator('.auth-form').evaluate((node) => {
    const color = getComputedStyle(node).backgroundColor
    return color.startsWith('rgb(') || Number(color.match(/[\d.]+/g)?.[3]) === 1
  })
  expect(alpha).toBe(true)
})
