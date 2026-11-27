import { expect, test } from '@playwright/test'
import { mockSignedIn } from './helpers/auth'

const org = '507f1f77bcf86cd799439011'
const supplierId = '507f1f77bcf86cd799439022'
const base = `/organizations/${org}/suppliers/${supplierId}`

for (const width of [375, 1440]) {
  test(`supplier contact responsibilities support multiple selections and pills at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await mockSignedIn(page)
    await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
    await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
    let contact = null
    const saves = []
    let supplierSave
    await page.route('**/api/v1/**', (route) => {
      const request = route.request()
      const path = new URL(request.url()).pathname.replace('/api/v1', '')
      let data = { items: [], next: null }
      if (path === '/organizations') {
        data = { items: [{ id: org, name: 'Acme Studio', status: 'active' }], next: null }
      } else if (path.endsWith('/permissions')) {
        data = {
          owner: true,
          grants: ['suppliers.view', 'suppliers.edit', 'suppliers.add'].map((key) => ({ key, scope: key.endsWith('.add') ? 'none' : 'all' })),
        }
      } else if (path.endsWith('/access')) {
        data = { writesAllowed: true, state: 'normal' }
      } else if (path === base) {
        data = { _id: supplierId, name: 'Acme Supply', status: 'active', capabilities: ['supplier'], revision: 1 }
      } else if (path === `/organizations/${org}/suppliers` && request.method() === 'POST') {
        supplierSave = request.postDataJSON()
        data = { ...supplierSave, _id: supplierId, status: 'active', revision: 1 }
      } else if (path === `${base}/defaults`) {
        data = { defaults: { revision: 3 } }
      } else if (path.startsWith(`${base}/contacts`) && ['POST', 'PATCH'].includes(request.method())) {
        const body = request.postDataJSON()
        saves.push(body)
        contact = { ...body, _id: 'contact-1', status: 'active', revision: 1 }
        data = contact
      } else if (path === `${base}/contacts`) {
        data = { items: contact ? [contact] : [], next: null }
      } else if (path === '/onboarding/me') {
        data = { application: null }
      }
      return route.fulfill({ json: { data } })
    })

    await page.goto(`/app/suppliers/${supplierId}`)
    await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tabpanel', { name: 'Overview', exact: true })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Defaults', exact: true })).toHaveCount(0)
    await page.getByRole('tab', { name: 'Contacts', exact: true }).click()
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Alex Supplier')
    await dialog.getByRole('textbox', { name: 'Email', exact: true }).fill('alex@supplier.com')
    const primary = dialog.getByRole('button', { name: 'Set as primary', exact: true })
    const tooltip = dialog.getByRole('tooltip', { includeHidden: true })
    await expect(primary).toHaveAttribute('aria-pressed', 'false')
    await expect(tooltip).toBeHidden()
    await primary.hover()
    await expect(tooltip).toBeVisible()
    await expect(tooltip).toHaveText('Set as primary')
    await primary.click()
    await expect(primary).toHaveAttribute('aria-pressed', 'true')
    await primary.press('Space')
    await expect(primary).toHaveAttribute('aria-pressed', 'false')
    await primary.press('Enter')
    await expect(primary).toHaveAttribute('aria-pressed', 'true')
    await expect(primary.locator('svg')).toHaveAttribute('fill', 'currentColor')
    const responsibilities = dialog.getByRole('button', { name: 'Contact responsibilities', exact: true })
    const primaryBox = await primary.boundingBox()
    const responsibilitiesBox = await responsibilities.boundingBox()
    expect(primaryBox.y).toBeLessThan(responsibilitiesBox.y)
    await responsibilities.click()
    await expect(dialog.getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true')
    await dialog.getByRole('option', { name: 'Sales account', exact: true }).click()
    await dialog.getByRole('option', { name: 'Production', exact: true }).click()
    await expect(dialog.getByRole('option', { name: 'Sales account', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(dialog.getByRole('option', { name: 'Production', exact: true })).toHaveAttribute('aria-selected', 'true')
    const search = dialog.getByRole('searchbox')
    await search.fill('Accounting')
    await search.press('Enter')
    await search.press('Escape')
    await expect(dialog).toBeVisible()
    await expect(responsibilities).toBeFocused()
    await expect(dialog.getByRole('listbox')).toHaveCount(0)
    const pills = dialog.getByRole('list', { name: 'Selected Contact responsibilities' })
    await expect(pills.getByRole('listitem')).toHaveCount(3)
    await pills.getByRole('button', { name: 'Remove Sales account' }).click()
    await expect(pills.getByRole('listitem')).toHaveCount(2)
    await responsibilities.click()
    await expect(dialog.getByRole('option', { name: 'Sales account', exact: true })).toHaveAttribute('aria-selected', 'false')
    await dialog.getByRole('option', { name: 'Accounting', exact: true }).click()
    await expect(dialog.getByRole('option', { name: 'Accounting', exact: true })).toHaveAttribute('aria-selected', 'false')
    await dialog.getByRole('option', { name: 'Ordering', exact: true }).click()
    await dialog.getByRole('searchbox').press('Escape')
    await expect(pills.getByRole('listitem')).toHaveCount(2)
    await expect(dialog.locator('.app-dialog-body')).toHaveJSProperty('scrollWidth', await dialog.locator('.app-dialog-body').evaluate((node) => node.clientWidth))
    await page.screenshot({ path: `test-results/supplier-responsibilities-${width}.png` })
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    expect(saves[0]).toMatchObject({
      purposes: ['production', 'ordering'],
      setDefaults: { expectedRevision: 3, primaryContact: true },
    })

    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await expect(pills.getByRole('listitem')).toHaveCount(2)
    await expect(pills.getByText('Production', { exact: true })).toBeVisible()
    await expect(pills.getByText('Ordering', { exact: true })).toBeVisible()
    await expect(primary).toHaveCount(0)
    await pills.getByRole('button', { name: 'Remove Production' }).click()
    await pills.getByRole('button', { name: 'Remove Ordering' }).click()
    await expect(pills).toHaveCount(0)
    await expect(responsibilities).toHaveText('Select responsibilities')
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    expect(saves[1].purposes).toEqual([])

    await page.goto('/app/suppliers')
    await page.locator('.page-heading').getByRole('button', { name: 'Create', exact: true }).click()
    await expect(dialog).toHaveAccessibleName('Add supplier')
    await expect(dialog.locator('.app-dialog-description')).toHaveCount(0)
    await expect(dialog.getByText('Tip', { exact: true })).toHaveCount(0)
    await dialog.getByRole('textbox', { name: 'Business name', exact: true }).fill('Compact Supply')
    const capabilities = dialog.getByRole('button', { name: 'Business capabilities', exact: true })
    const capabilityPills = dialog.getByRole('list', { name: 'Selected Business capabilities' })
    await expect(capabilityPills.getByRole('listitem')).toHaveCount(1)
    await capabilityPills.getByRole('button', { name: 'Remove Supplies products' }).click()
    await dialog.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(dialog.getByText('Select at least one capability', { exact: true })).toBeVisible()
    await capabilities.click()
    await expect(dialog.getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true')
    await dialog.getByRole('option', { name: 'Supplies products', exact: true }).click()
    await dialog.getByRole('option', { name: 'Decorates products', exact: true }).click()
    await expect(dialog.getByRole('option', { name: 'Supplies products', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(dialog.getByRole('option', { name: 'Decorates products', exact: true })).toHaveAttribute('aria-selected', 'true')
    await dialog.getByRole('searchbox').press('Escape')
    await expect(capabilityPills.getByRole('listitem')).toHaveCount(2)
    await dialog.getByRole('textbox', { name: 'Website', exact: true }).fill('https://supplier.example.com')
    await dialog.getByRole('textbox', { name: 'General email', exact: true }).fill('orders@supplier.com')
    const websiteBox = await dialog.getByRole('textbox', { name: 'Website', exact: true }).boundingBox()
    const phoneBox = await dialog.getByRole('textbox', { name: 'Phone', exact: true }).boundingBox()
    if (width > 640) expect(websiteBox.y).toBe(phoneBox.y)
    await expect(dialog.locator('.app-dialog-body')).toHaveJSProperty('scrollWidth', await dialog.locator('.app-dialog-body').evaluate((node) => node.clientWidth))
    await page.screenshot({ path: `test-results/add-supplier-${width}.png` })
    await dialog.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    expect(supplierSave).toMatchObject({
      name: 'Compact Supply',
      capabilities: ['decorator', 'supplier'],
      website: 'https://supplier.example.com',
      email: 'orders@supplier.com',
    })
    await expect(page).toHaveURL(`/app/suppliers/${supplierId}`)
    await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tabpanel', { name: 'Overview', exact: true })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Defaults', exact: true })).toHaveCount(0)
  })
}
