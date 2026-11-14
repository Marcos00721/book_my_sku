import { expect, test } from '@playwright/test'
import { mockSignedIn } from './helpers/auth'

const org = '507f1f77bcf86cd799439011'
const supplierId = '507f1f77bcf86cd799439022'
const categoryId = '507f1f77bcf86cd799439033'

for (const width of [375, 1440]) {
  test(`product dropdowns allow searching and selecting inside the modal at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await mockSignedIn(page)
    await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
    await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
    await page.route('**/api/v1/**', (route) => {
      const path = new URL(route.request().url()).pathname.replace('/api/v1', '')
      let data = { items: [], next: null }
      if (path === '/organizations') {
        data = { items: [{ id: org, name: 'Acme Studio', status: 'active' }], next: null }
      } else if (path.endsWith('/permissions')) {
        data = {
          owner: true,
          grants: ['products.view', 'products.create', 'suppliers.create'].map((key) => ({ key, scope: 'all' })),
        }
      } else if (path.endsWith('/access')) {
        data = { writesAllowed: true, state: 'normal' }
      } else if (path.endsWith('/supplier-options')) {
        data = { items: [{ id: supplierId, name: 'Acme Supply' }], next: null }
      } else if (path.endsWith('/category-options')) {
        data = { items: [{ id: categoryId, label: 'Apparel' }], next: null }
      } else if (path === '/onboarding/me') {
        data = { application: null }
      }
      return route.fulfill({ json: { data } })
    })

    await page.goto('/app/products')
    // The shared dropdown also works outside a dialog.
    const status = page.getByRole('button', { name: 'Product status', exact: true })
    await status.click()
    await page.getByRole('option', { name: 'Draft', exact: true }).click()
    await expect(status).toHaveText('Draft')
    await page.locator('.page-heading').getByRole('button', { name: 'Create', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('textbox', { name: 'Product name', exact: true }).fill('Classic polo')

    for (const { label, option, value, field } of [
      { label: 'Supplier', option: 'Acme Supply', value: supplierId, field: 'supplierId' },
      { label: 'Product category', option: 'Apparel', value: categoryId, field: 'categoryId' },
    ]) {
      const trigger = dialog.getByRole('button', { name: label, exact: true })
      await trigger.click()
      const search = dialog.getByRole('searchbox')
      await expect(search).toBeFocused()
      await search.fill(option)
      const choice = dialog.getByRole('option', { name: option, exact: true })
      await expect(choice).toBeInViewport({ ratio: 1 })
      // A real pointer click also catches clipping and modal hit-testing failures.
      await choice.click({ timeout: 5000 })
      await expect(trigger).toHaveText(option)
      await expect(dialog.locator(`input[name="${field}"]`)).toHaveValue(value)
      await expect(dialog.getByRole('listbox')).toHaveCount(0)
      await expect(trigger).toBeFocused()
    }
    const supplier = dialog.getByRole('button', { name: 'Supplier', exact: true })
    await supplier.focus()
    await supplier.press('ArrowDown')
    await dialog.getByRole('searchbox').fill('Acme')
    await dialog.getByRole('searchbox').press('Enter')
    await expect(supplier).toHaveText('Acme Supply')
    await expect(supplier).toBeFocused()

    await supplier.click()
    await dialog.getByRole('searchbox').press('Escape')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('listbox')).toHaveCount(0)
    await expect(supplier).toBeFocused()

    await supplier.click()
    await dialog.getByRole('textbox', { name: 'Product name', exact: true }).click()
    await expect(dialog.getByRole('listbox')).toHaveCount(0)
    await expect(dialog.getByRole('textbox', { name: 'Product name', exact: true })).toHaveValue('Classic polo')
  })
}
