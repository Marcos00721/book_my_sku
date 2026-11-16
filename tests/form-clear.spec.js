import { expect, test } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { mockSignedIn } from './helpers/auth'
import { mockGeography } from './helpers/geography'

const org = '507f1f77bcf86cd799439011'
const supplierId = '507f1f77bcf86cd799439022'
const root = `/organizations/${org}`
const supplierPath = `${root}/suppliers/${supplierId}`
const contact = {
  _id: '507f1f77bcf86cd799439033', name: 'Saved contact',
  email: 'saved@supplier.com', purposes: ['production'], status: 'active', revision: 2,
}

async function setup(page) {
  const writes = []
  await mockSignedIn(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
  await page.route('**/api/v1/**', (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace('/api/v1', '')
    let data = { items: [], next: null }
    if (request.method() !== 'GET') writes.push({ path, body: request.postDataJSON() })
    if (path === '/organizations') {
      data = { items: [{ id: org, name: 'Acme Studio', status: 'active' }], next: null }
    } else if (path.endsWith('/permissions')) {
      data = {
        owner: true,
        grants: ['suppliers.view', 'suppliers.create', 'suppliers.edit', 'products.view', 'products.create', 'products.edit', 'master_data.view'].map((key) => ({ key, scope: 'all' })),
      }
    } else if (path.endsWith('/access')) {
      data = { writesAllowed: true, state: 'normal' }
    } else if (path === supplierPath) {
      data = { _id: supplierId, name: 'Acme Supply', capabilities: ['supplier'], status: 'active', revision: 1 }
    } else if (path === `${supplierPath}/contacts`) {
      data = { items: [contact], next: null }
    } else if (path.endsWith('/defaults')) {
      data = { defaults: { revision: 3 } }
    } else if (path.endsWith('/supplier-options')) {
      data = { items: [{ id: supplierId, name: 'Acme Supply' }], next: null }
    } else if (path === `${root}/master-data/industry` && request.method() === 'POST') {
      data = { id: 'new-entry', ...request.postDataJSON() }
    }
    return route.fulfill({ json: { data } })
  })
  await mockGeography(page)
  return writes
}

async function openContacts(page) {
  await page.goto(`/app/suppliers/${supplierId}`)
  await page.getByRole('tab', { name: 'Contacts', exact: true }).click()
}

for (const width of [375, 1440]) {
  test(`Clear resets a supplier draft and errors without closing at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const writes = await setup(page)
    await page.goto('/app/suppliers')
    await page.locator('.page-heading').getByRole('button', { name: 'Create', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('textbox', { name: 'Business name', exact: true }).fill('Draft business')
    await dialog.getByRole('textbox', { name: 'Account number', exact: true }).fill('12345')
    await dialog.getByRole('textbox', { name: 'General email', exact: true }).fill('invalid-email')
    await dialog.getByRole('button', { name: 'Business capabilities', exact: true }).click()
    await dialog.getByRole('option', { name: 'Decorates products', exact: true }).click()
    await dialog.getByRole('searchbox').press('Escape')
    await dialog.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(dialog.getByRole('alert')).toBeVisible()
    await dialog.getByRole('button', { name: 'Clear', exact: true }).click()
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('textbox', { name: 'Business name', exact: true })).toHaveValue('')
    await expect(dialog.getByRole('textbox', { name: 'Business name', exact: true })).toBeFocused()
    await expect(dialog.getByRole('textbox', { name: 'Account number', exact: true })).toHaveValue('')
    await expect(dialog.getByRole('textbox', { name: 'General email', exact: true })).toHaveValue('')
    await expect(dialog.getByRole('alert')).toHaveCount(0)
    const pills = dialog.getByRole('list', { name: 'Selected Business capabilities' })
    await expect(pills.getByRole('listitem')).toHaveCount(1)
    await expect(pills).toContainText('Supplies products')
    expect(writes).toHaveLength(0)
    await page.screenshot({ path: testInfo.outputPath('cleared-supplier.png') })
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
}

test('Clear restores a saved contact and resets its responsibility pills', async ({ page }) => {
  const writes = await setup(page)
  await openContacts(page)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Changed name')
  await dialog.getByRole('button', { name: 'Remove Production', exact: true }).click()
  await dialog.getByRole('button', { name: 'Contact responsibilities', exact: true }).click()
  await dialog.getByRole('option', { name: 'Accounting', exact: true }).click()
  await dialog.getByRole('searchbox').press('Escape')
  await dialog.getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(dialog.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(contact.name)
  const pills = dialog.getByRole('list', { name: 'Selected Contact responsibilities' })
  await expect(pills.getByRole('listitem')).toHaveCount(1)
  await expect(pills).toContainText('Production')
  expect(writes).toHaveLength(0)
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('Clear resets an address, geography, purposes and default star', async ({ page }) => {
  const writes = await setup(page)
  await page.goto(`/app/suppliers/${supplierId}`)
  await page.getByRole('tab', { name: 'Addresses', exact: true }).click()
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: 'Label', exact: true }).fill('Draft dock')
  await dialog.getByRole('textbox', { name: 'City', exact: true }).fill('Jaipur')
  await dialog.getByRole('button', { name: 'Country', exact: true }).click()
  await dialog.getByRole('option', { name: 'India', exact: true }).click()
  await dialog.getByRole('button', { name: 'State', exact: true }).click()
  await dialog.getByRole('option', { name: 'Rajasthan', exact: true }).click()
  await dialog.getByRole('button', { name: 'Address purposes', exact: true }).click()
  await dialog.getByRole('option', { name: 'Receiving', exact: true }).click()
  await dialog.getByRole('searchbox').press('Escape')
  await dialog.getByRole('button', { name: 'Set as default', exact: true }).click()
  await dialog.getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: 'Label', exact: true })).toHaveValue('')
  await expect(dialog.getByRole('textbox', { name: 'City', exact: true })).toHaveValue('')
  await expect(dialog.getByRole('button', { name: 'Country', exact: true })).toHaveText('Choose a country')
  await expect(dialog.getByRole('button', { name: 'State', exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Set as default', exact: true })).toHaveAttribute('aria-pressed', 'false')
  const pills = dialog.getByRole('list', { name: 'Selected Address purposes' })
  await expect(pills.getByRole('listitem')).toHaveCount(1)
  await expect(pills).toContainText('Ordering')
  expect(writes).toHaveLength(0)
})

test('Clear resets controlled reference fields and the next save uses the new draft', async ({ page }) => {
  const writes = await setup(page)
  await page.goto('/app/master-data')
  await page.locator('.page-heading').getByRole('button', { name: 'Create', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Discarded name')
  await dialog.getByRole('textbox', { name: 'Description', exact: true }).fill('Discarded description')
  await dialog.getByRole('spinbutton', { name: 'Sort order', exact: true }).fill('42')
  await dialog.getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('')
  await expect(dialog.getByRole('textbox', { name: 'Description', exact: true })).toHaveValue('')
  await expect(dialog.getByRole('spinbutton', { name: 'Sort order', exact: true })).toHaveValue('0')
  expect(writes).toHaveLength(0)
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Fresh name')
  await dialog.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(writes[0].body).toEqual({ label: 'Fresh name', description: null, sortOrder: 0 })
})

test('Clear resets a product image, rich text and supplier selection', async ({ page }) => {
  const writes = await setup(page)
  await page.goto('/app/products')
  await page.locator('.page-heading').getByRole('button', { name: 'Create', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: 'Product name', exact: true }).fill('Draft product')
  await dialog.getByRole('textbox', { name: 'Description', exact: true }).fill('Draft description')
  await dialog.getByRole('button', { name: 'Supplier', exact: true }).click()
  await dialog.getByRole('option', { name: 'Acme Supply', exact: true }).click()
  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'draft-cover.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1EAAAAASUVORK5CYII=', 'base64'),
  })
  await expect(dialog.getByText('draft-cover.png', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: 'Product name', exact: true })).toHaveValue('')
  await expect(dialog.getByRole('textbox', { name: 'Description', exact: true })).toHaveText('')
  await expect(dialog.getByRole('button', { name: 'Supplier', exact: true })).not.toContainText('Acme Supply')
  await expect(dialog.getByText('draft-cover.png', { exact: true })).toHaveCount(0)
  expect(writes).toHaveLength(0)
})

test('Clear is unavailable during a pending or uncertain save', async ({ page }) => {
  await setup(page)
  let release
  const gate = new Promise((resolve) => { release = resolve })
  await page.route(`**${supplierPath}/contacts`, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    await gate
    return route.fulfill({ status: 503, json: { error: { code: 'INTERNAL_ERROR', message: 'Save outcome is uncertain.' } } })
  })
  await openContacts(page)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Pending contact')
  await dialog.getByRole('textbox', { name: 'Email', exact: true }).fill('pending@supplier.com')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Clear', exact: true })).toBeDisabled()
  release()
  await expect(dialog.getByRole('button', { name: 'Retry same request', exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Clear', exact: true })).toBeDisabled()
  await expect(dialog.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Pending contact')
})
