import { expect, test } from '@playwright/test'
import { mockSignedIn } from './helpers/auth'

const orgId = '507f1f77bcf86cd799439011'
const roleId = '507f1f77bcf86cd799439041'
const catalog = [
  { key: 'clients.view', label: 'View clients', scopes: ['assigned', 'all'], enabled: true },
  { key: 'clients.create', label: 'Create clients', scopes: ['none'], enabled: true },
  { key: 'clients.edit', label: 'Edit clients', scopes: ['assigned', 'all'], enabled: true },
  { key: 'clients.delete', label: 'Delete clients', scopes: ['all'], enabled: false },
  { key: 'clients.export', label: 'Export clients', scopes: [], enabled: true },
  { key: 'clients.history.view', label: 'View client history', scopes: ['all'], enabled: true },
  ...['contacts', 'diagnostics', 'inquiries', 'leads', 'products', 'suppliers', 'orders', 'quotes', 'invoices', 'reports', 'catalog', 'pricing', 'workflows', 'deliveries'].flatMap((area) =>
    ['view', 'create', 'edit'].map((action) => ({
      key: `${area}.${action}`,
      label: `${action[0].toUpperCase() + action.slice(1)} ${area}`,
      scopes: action === 'create' ? ['none'] : ['assigned', 'all'],
      enabled: true,
    })),
  ),
]
const savedRole = {
  id: roleId, name: 'Account manager', revision: 8, archived: false,
  grants: [{ key: 'clients.view', scope: 'all' }],
}

async function setup(page) {
  await mockSignedIn(page)
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname
    const data = path.endsWith('/organizations')
      ? { items: [{ id: orgId, name: 'Acme Promotions', status: 'active' }], next: null }
      : path.endsWith('/permissions')
        ? { owner: true, grants: [] }
        : path.endsWith('/access')
          ? { state: 'normal', writesAllowed: true }
          : path.endsWith('/roles/catalog')
            ? { items: catalog }
            : path.endsWith('/roles')
              ? { items: [savedRole], next: null }
              : { items: [], next: null }
    return route.fulfill({ json: { data } })
  })
  await page.goto('/app/roles')
}

test('create role searches without losing grants and selects only matching available permissions', async ({ page }) => {
  await setup(page)
  let submitted
  await page.route(`**/organizations/${orgId}/roles`, (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    submitted = route.request().postDataJSON()
    return route.fulfill({ json: { data: { ...submitted, id: roleId } } })
  })
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Create role' })
  await expect(dialog.getByLabel('Role name')).toBeFocused()
  await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  await dialog.getByLabel('Role name').fill('Support team')
  await dialog.getByRole('checkbox', { name: 'View clients', exact: true }).check()
  await dialog.getByRole('combobox', { name: 'Scope for View clients' }).selectOption('all')
  const search = dialog.getByRole('searchbox', { name: 'Search permissions' })
  await search.fill('Create clients')
  await dialog.getByRole('checkbox', { name: 'Select all matching Clients permissions' }).check()
  await search.fill('')
  await expect(dialog.getByRole('checkbox', { name: 'View clients', exact: true })).toBeChecked()
  await expect(dialog.getByRole('combobox', { name: 'Scope for View clients' })).toHaveValue('all')
  await expect(dialog.getByRole('checkbox', { name: 'Edit clients', exact: true })).not.toBeChecked()
  await expect(dialog.getByRole('checkbox', { name: 'Delete clients', exact: true })).toBeDisabled()
  await expect(dialog.getByRole('checkbox', { name: 'Export clients', exact: true })).toBeDisabled()
  expect(await dialog.getByRole('checkbox', { name: 'Select all Clients permissions' }).evaluate((el) => el.indeterminate)).toBe(true)
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(submitted).toEqual({ name: 'Support team', grants: [
    { key: 'clients.view', scope: 'all' }, { key: 'clients.create', scope: 'none' },
  ] })
})

test('edit keeps existing scopes during group selection and Clear restores saved permissions', async ({ page }) => {
  await setup(page)
  let submitted
  await page.route(`**/roles/${roleId}`, (route) => {
    submitted = route.request().postDataJSON()
    return route.fulfill({ json: { data: savedRole } })
  })
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit role' })
  await dialog.getByRole('checkbox', { name: 'Select all Clients permissions' }).check()
  await expect(dialog.getByRole('combobox', { name: 'Scope for View clients' })).toHaveValue('all')
  await expect(dialog.getByRole('combobox', { name: 'Scope for Edit clients' })).toHaveValue('assigned')
  await dialog.getByLabel('Role name').fill('Changed name')
  await dialog.getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(dialog.getByLabel('Role name')).toHaveValue(savedRole.name)
  await expect(dialog.getByRole('checkbox', { name: 'Create clients', exact: true })).not.toBeChecked()
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(submitted).toEqual({ name: savedRole.name, grants: savedRole.grants, expectedRevision: 8 })
})

test('contact dependency has an explicit one-click fix and search has a recovery action', async ({ page }) => {
  await setup(page)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('checkbox', { name: 'View contacts', exact: true }).check()
  await expect(dialog.getByRole('checkbox', { name: 'View clients', exact: true })).not.toBeChecked()
  await dialog.getByRole('button', { name: 'Enable Clients view' }).click()
  await expect(dialog.getByRole('checkbox', { name: 'View clients', exact: true })).toBeChecked()
  await expect(dialog.getByRole('button', { name: 'Enable Clients view' })).toHaveCount(0)
  await dialog.getByRole('searchbox').fill('missing-permission')
  await expect(dialog.getByRole('heading', { name: 'No matching permissions' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Clear search' }).click()
  await expect(dialog.getByRole('checkbox', { name: 'View contacts', exact: true })).toBeChecked()
})

test('uncertain role saves lock the draft and recover with the same payload and operation key', async ({ page }) => {
  await setup(page)
  const attempts = []
  await page.route(`**/roles/${roleId}`, (route) => {
    attempts.push({ body: route.request().postDataJSON(), key: route.request().headers()['idempotency-key'] })
    return attempts.length === 1
      ? route.fulfill({ status: 503, json: { error: { message: 'Save outcome is uncertain.' } } })
      : route.fulfill({ json: { data: savedRole } })
  })
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog.getByLabel('Role name')).toBeDisabled()
  await expect(dialog.getByRole('checkbox', { name: 'Select all Clients permissions' })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Close dialog' })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Retry same request' }).click()
  await expect(dialog).toHaveCount(0)
  expect(attempts).toHaveLength(2)
  expect(attempts[0].key).toBeTruthy()
  expect(attempts[1]).toEqual(attempts[0])
})

for (const [width, height] of [[375, 640], [834, 724], [834, 480], [1440, 900]]) {
  test(`role dialogs align and scroll to the last permission at ${width}x${height} in both themes`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height })
    await page.addInitScript(() => localStorage.setItem('theme', 'light'))
    await setup(page)
    for (const mode of ['light', 'dark']) {
      if (mode === 'dark') await page.getByRole('button', { name: 'Switch to dark mode' }).click()
      await page.getByRole('button', { name: mode === 'light' ? 'Create' : 'Edit', exact: true }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      const box = await dialog.boundingBox()
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(width)
      expect(box.y + box.height).toBeLessThanOrEqual(height)
      expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
      const group = dialog.getByRole('region', { name: 'Clients', exact: true })
      const rows = group.locator('.role-editor-row')
      const before = await rows.first().boundingBox()
      await dialog.getByRole('checkbox', { name: 'View clients', exact: true }).setChecked(true)
      const after = await rows.first().boundingBox()
      expect(after.height).toBe(before.height)
      const scope = await dialog.getByRole('combobox', { name: 'Scope for View clients' }).boundingBox()
      const access = await rows.nth(1).locator('.role-editor-access-note').boundingBox()
      expect(Math.abs(scope.x - access.x)).toBeLessThan(2)
      await page.screenshot({ path: testInfo.outputPath(`role-${mode}.png`), fullPage: true })
      const footer = dialog.locator('.dialog-footer')
      const footerBefore = await footer.boundingBox()
      const permissions = dialog.getByRole('region', { name: 'Permission groups' })
      const scrollSize = await permissions.evaluate((el) => ({ height: el.clientHeight, content: el.scrollHeight }))
      expect(scrollSize.height).toBeGreaterThan(60)
      expect(scrollSize.content).toBeGreaterThan(scrollSize.height)
      await permissions.hover()
      await page.mouse.wheel(0, 10000)
      await expect.poll(() => permissions.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
      const lastPermission = dialog.getByRole('checkbox', { name: 'Edit deliveries', exact: true })
      await expect(lastPermission).toBeInViewport()
      const listBox = await permissions.boundingBox()
      await expect.poll(async () => {
        const lastBox = await lastPermission.boundingBox()
        return lastBox.y + lastBox.height <= listBox.y + listBox.height
      }).toBe(true)
      await lastPermission.check()
      await expect(lastPermission).toBeChecked()
      await page.screenshot({ path: testInfo.outputPath(`role-${mode}-scrolled.png`), fullPage: true })
      const footerAfter = await footer.boundingBox()
      expect(footerAfter.y).toBe(footerBefore.y)
      await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeInViewport()
      await dialog.getByRole('button', { name: 'Clear', exact: true }).click()
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
      await expect(dialog).toHaveCount(0)
    }
  })
}
