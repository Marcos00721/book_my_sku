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
          grants: ['products.view', 'products.add', 'suppliers.add'].map((key) => ({ key, scope: key.endsWith('.add') ? 'none' : 'all' })),
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

test('product editors save independent formatting and render it in the overview', async ({ page }) => {
  await mockSignedIn(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('https://fonts.googleapis.com/**', route => route.abort())
  await page.route('https://fonts.gstatic.com/**', route => route.abort())
  const productId = '507f1f77bcf86cd799439044'
  const productsRoot = `/organizations/${org}/products`
  const product = { id: productId, name: 'Classic polo', supplierId, status: 'draft', revision: 1 }
  const writes = []
  await page.route('**/api/v1/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace('/api/v1', '')
    let data = { items: [], next: null }
    if (path === '/organizations') data = { items: [{ id: org, name: 'Acme Studio', status: 'active' }] }
    else if (path.endsWith('/permissions')) data = { owner: true, grants: ['products.view', 'products.add', 'products.edit'].map(key => ({ key, scope: key.endsWith('.add') ? 'none' : 'all' })) }
    else if (path.endsWith('/access')) data = { writesAllowed: true, state: 'normal' }
    else if (path.endsWith('/supplier-options')) data = { items: [{ id: supplierId, name: 'Acme Supply' }], next: null }
    else if (path === productsRoot && request.method() === 'POST') {
      writes.push(request.postDataJSON())
      Object.assign(product, writes.at(-1))
      data = product
    } else if (path === `${productsRoot}/${productId}`) data = product
    await route.fulfill({ json: { data } })
  })
  await page.goto('/app/products')
  await page.locator('.page-heading').getByRole('button', { name: 'Create', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: 'Product name', exact: true }).fill('Classic polo')
  await dialog.getByRole('button', { name: 'Supplier', exact: true }).click()
  await dialog.getByRole('option', { name: 'Acme Supply', exact: true }).click()
  const description = dialog.getByRole('textbox', { name: 'Description', exact: true })
  const notes = dialog.getByRole('textbox', { name: 'Private notes', exact: true })
  await description.fill('Public description')
  await description.press('ControlOrMeta+a')
  const descriptionEditor = dialog.locator('.text-editor').filter({ has: page.getByRole('textbox', { name: 'Description', exact: true }) })
  await descriptionEditor.getByRole('combobox', { name: 'Text style' }).selectOption('3')
  await notes.fill('Internal details')
  await notes.press('ControlOrMeta+a')
  const notesEditor = dialog.locator('.text-editor').filter({ has: page.getByRole('textbox', { name: 'Private notes', exact: true }) })
  await notesEditor.getByRole('button', { name: 'Underline', exact: true }).click()
  await expect(description.locator('u')).toHaveCount(0)
  await expect(notes.locator('u')).toHaveText('Internal details')
  await dialog.getByRole('button', { name: 'Create Product', exact: true }).click()
  await expect(page).toHaveURL(`/app/products/${productId}`)
  await expect(page.locator('.detail-list .rich-text h3')).toHaveText('Public description')
  await expect(page.locator('.detail-list .rich-text u')).toHaveText('Internal details')
  expect(writes).toHaveLength(1)
  expect(writes[0].description).toContain('<h3>Public description</h3>')
  expect(writes[0].privateNotes).toBe('<p><u>Internal details</u></p>')
})
