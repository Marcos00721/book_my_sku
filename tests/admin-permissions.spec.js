import { expect, test } from '@playwright/test'
import { mockSignedIn } from './helpers/auth'
import { contrastRatio } from './helpers/contrast'

const catalog = [
  { key: 'clients.view', label: 'View clients', scopes: ['assigned', 'all'], enabled: true, revision: 3 },
  { key: 'clients.create', label: 'Create clients', scopes: ['none'], enabled: true, revision: 2 },
  { key: 'clients.delete', label: 'Delete clients', scopes: ['all'], enabled: false, revision: 4 },
  { key: 'products.view', label: 'View products', scopes: ['all'], enabled: true, revision: 1 },
  { key: 'products.edit', label: 'Edit products and their associated configuration details', scopes: ['assigned', 'all'], enabled: false, revision: 5 },
  { key: 'suppliers.view', label: 'View suppliers', scopes: [], enabled: true, revision: 1 },
]

async function setup(page, mode = 'light') {
  await mockSignedIn(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(theme => localStorage.setItem('theme', theme), mode)
  await page.route('https://fonts.googleapis.com/**', route => route.abort())
  await page.route('https://fonts.gstatic.com/**', route => route.abort())
  const items = structuredClone(catalog)
  const writes = []
  await page.route('**/api/v1/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace('/api/v1', '')
    let data = { items: [] }
    if (path === '/admin/me') data = { role: 'super_admin' }
    if (path === '/admin/permissions') data = { items }
    if (path.startsWith('/admin/permissions/') && request.method() === 'PUT') {
      const body = request.postDataJSON()
      writes.push({ path, body })
      const entry = items.find(item => item.key === path.split('/').at(-1))
      Object.assign(entry, body, { revision: entry.revision + 1 })
      data = entry
    }
    await route.fulfill({ json: { data } })
  })
  return { writes }
}

for (const mode of ['light', 'dark']) {
  for (const width of [390, 1440]) {
    test(`permission catalog and editor fit ${width}px in ${mode}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 })
      await setup(page, mode)
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto('/admin?section=catalog')
      await expect(page.getByRole('button', { name: /^Configure / })).toHaveCount(6)
      await expect(page.getByRole('region', { name: 'Clients', exact: true })).toContainText('Assigned records')
      await expect(page.getByRole('region', { name: 'Suppliers', exact: true })).toContainText('No supported scopes')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      expect(await contrastRatio(page.locator('.permission-status--enabled').first())).toBeGreaterThanOrEqual(4.5)
      await page.screenshot({ path: testInfo.outputPath(`catalog-${mode}-${width}.png`), fullPage: true })
      await page.getByRole('button', { name: 'Configure View clients', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Configure permission' })
      await expect(dialog.getByLabel('Display label')).toBeFocused()
      await expect(dialog).toContainText('clients.view')
      await expect(dialog).toContainText('Assigned records')
      await expect(dialog.getByRole('button', { name: 'Save catalog entry' })).toBeInViewport()
      expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath(`editor-${mode}-${width}.png`), fullPage: true })
      expect(errors).toEqual([])
    })
  }
}

test('search, module and status filters combine and reset together', async ({ page }) => {
  await setup(page)
  await page.goto('/admin?section=catalog')
  await page.getByRole('button', { name: 'Module', exact: true }).click()
  await page.getByRole('option', { name: 'Clients', exact: true }).click()
  await page.getByRole('group', { name: 'Permission status' }).getByRole('button', { name: /^Enabled / }).click()
  await expect(page.getByRole('button', { name: /^Configure / })).toHaveCount(2)
  await page.getByRole('searchbox', { name: 'Find a permission' }).fill(' CLIENTS.VIEW ')
  await expect(page.getByRole('button', { name: /^Configure / })).toHaveCount(1)
  await expect(page.locator('.permission-result-count')).toHaveText('1 permission of 6')
  await page.getByRole('searchbox', { name: 'Find a permission' }).fill('missing')
  await expect(page.getByRole('heading', { name: 'No matching permissions' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).last().click()
  await expect(page.getByRole('searchbox', { name: 'Find a permission' })).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Module', exact: true })).toHaveText('All modules')
  await expect(page.getByRole('button', { name: /^Configure / })).toHaveCount(6)
})

test('configuration preserves revision and scopes and refreshes saved status', async ({ page }) => {
  const { writes } = await setup(page)
  await page.goto('/admin?section=catalog')
  await page.getByRole('button', { name: 'Configure View clients', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Configure permission' })
  await dialog.getByLabel('Display label').fill('   ')
  await expect(dialog.getByRole('button', { name: 'Save catalog entry' })).toBeDisabled()
  await dialog.getByLabel('Display label').fill('Read client records')
  await dialog.getByRole('checkbox', { name: /Enable permission/ }).uncheck()
  await expect(dialog).toContainText('including from roles that already have it')
  expect(writes).toEqual([])
  await dialog.getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(dialog.getByLabel('Display label')).toHaveValue('View clients')
  await expect(dialog.getByRole('checkbox')).toBeChecked()
  await dialog.getByLabel('Display label').fill('Read client records')
  await dialog.getByRole('checkbox').uncheck()
  await dialog.getByRole('button', { name: 'Save catalog entry' }).click()
  await expect(dialog).toHaveCount(0)
  const row = page.locator('.permission-row').filter({ hasText: 'clients.view' })
  await expect(row).toContainText('Read client records')
  await expect(row).toContainText('Disabled')
  expect(writes).toEqual([{ path: '/admin/permissions/clients.view', body: { expectedRevision: 3, label: 'Read client records', enabled: false, scopes: ['assigned', 'all'] } }])
})
