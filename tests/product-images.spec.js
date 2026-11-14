import { expect, test } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mockSignedIn } from './helpers/auth'

const org = '507f1f77bcf86cd799439011'
const supplierId = '507f1f77bcf86cd799439022'
const productId = '507f1f77bcf86cd799439033'
const assetId = '507f1f77bcf86cd799439044'
const root = `/organizations/${org}`
const productPath = `${root}/products/${productId}`
const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1EAAAAASUVORK5CYII=', 'base64')
const image = { name: 'polo.png', mimeType: 'image/png', buffer: bytes }

async function setup(page, { failStage, canEdit = true } = {}) {
  const writes = []
  let created = false
  let cover = false
  const product = () => ({
    id: productId,
    name: 'Classic polo',
    productCode: 'PRD-000001',
    supplierId,
    supplier: { id: supplierId, name: 'Acme Supply', eligible: true },
    status: 'draft',
    revision: cover ? 2 : 1,
    configuration: { mode: 'unresolved', dimensions: [] },
    readiness: { activationBlockers: [], restoreBlockers: [] },
  })
  await mockSignedIn(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
  await page.route('https://images.example.test/**', (route) => route.fulfill({ contentType: 'image/png', body: bytes }))
  await page.route('**/api/v1/**', (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace('/api/v1', '')
    const reply = (data) => route.fulfill({ json: { data } })
    const stage = request.method() === 'GET' ? null
      : path === `${root}/products` ? 'create'
        : path.endsWith('/media/intents') ? 'reservation'
          : path.endsWith('/content') ? 'upload'
            : path.endsWith('/media/association') ? 'association' : null
    if (stage) {
      writes.push({
        stage,
        path,
        key: request.headers()['idempotency-key'],
        type: request.headers()['content-type'],
        body: stage === 'upload' ? request.postDataBuffer() : request.postDataJSON(),
      })
      if (stage === 'create') created = true
      if (stage === 'association') cover = true
      if (stage === failStage && writes.filter((write) => write.stage === stage).length === 1) {
        return route.fulfill({ status: 503, json: { error: { code: 'TEMPORARILY_UNAVAILABLE', message: 'Please retry the interrupted request.' } } })
      }
      return reply(stage === 'create' ? product()
        : stage === 'reservation' ? { id: assetId }
          : stage === 'association' ? { revision: 2 } : { state: 'ready' })
    }
    if (path === '/organizations') return reply({ items: [{ id: org, name: 'Acme', status: 'active' }], next: null })
    if (path.endsWith('/permissions')) return reply({
      owner: true,
      grants: ['products.view', 'products.create', ...(canEdit ? ['products.edit'] : [])].map((key) => ({ key, scope: 'all' })),
    })
    if (path === `${root}/access`) return reply({ writesAllowed: true, state: 'normal' })
    if (path.endsWith('/supplier-options')) return reply({ items: [{ id: supplierId, name: 'Acme Supply' }] })
    if (path === `${root}/products`) return reply({ items: created ? [product()] : [], next: null })
    if (path === productPath) return reply(product())
    if (path === `${productPath}/media`) return reply({
      revision: product().revision,
      items: cover ? [{ id: assetId, state: 'ready' }] : [],
      effectiveAssetId: cover ? assetId : null,
      source: cover ? 'primary' : 'none',
    })
    if (path.endsWith(`/media/${assetId}/access`)) return reply({ url: 'https://images.example.test/cover.png', expiresInSeconds: 300 })
    return reply({ items: [], next: null })
  })
  await page.goto('/app/products')
  await page.locator('.page-heading').getByRole('button', { name: 'Create', exact: true }).click()
  return writes
}

async function fillProduct(page) {
  const dialog = page.getByRole('dialog', { name: 'Create custom product', exact: true })
  await dialog.getByRole('textbox', { name: 'Product name', exact: true }).fill('Classic polo')
  await dialog.getByRole('button', { name: 'Supplier', exact: true }).click()
  await dialog.getByRole('option', { name: 'Acme Supply', exact: true }).click()
  return dialog
}

for (const width of [375, 1440]) {
  test(`create a product with a cover image at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const writes = await setup(page)
    const dialog = await fillProduct(page)
    await dialog.locator('input[type="file"]').setInputFiles(image)
    await expect(dialog.getByRole('img', { name: 'polo.png', exact: true })).toBeVisible()
    expect(writes).toEqual([])
    await dialog.getByRole('button', { name: 'Preview polo.png', exact: true }).click()
    const preview = page.getByRole('dialog', { name: 'Image preview', exact: true })
    await expect(preview.getByRole('img')).toBeVisible()
    await preview.getByRole('button', { name: 'Close dialog', exact: true }).click()
    await dialog.getByRole('button', { name: 'Create Product', exact: true }).click()
    await expect(page).toHaveURL(`/app/products/${productId}`)
    expect(writes.map((write) => write.stage)).toEqual(['create', 'reservation', 'upload', 'association'])
    expect(writes[1].body).toEqual({
      expectedRevision: 1,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      type: 'image/png',
    })
    expect(writes[2].body).toEqual(bytes)
    expect(writes[2].type).toBe('image/png')
    expect(writes[3].body).toEqual({ expectedRevision: 1, assetId })
    await page.getByRole('tab', { name: 'Images', exact: true }).click()
    await expect(page.getByText('Image source: Product cover image', { exact: false })).toBeVisible()
    await expect(page.getByRole('img', { name: `Image ${assetId.slice(-6)}`, exact: true })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  })
}

for (const failStage of ['create', 'reservation', 'upload', 'association']) {
  test(`resume ${failStage} after interruption without duplicating the product or upload`, async ({ page }) => {
    const writes = await setup(page, { failStage })
    const dialog = await fillProduct(page)
    await dialog.locator('input[type="file"]').setInputFiles(image)
    await dialog.getByRole('button', { name: 'Create Product', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('Please retry the interrupted request.')
    const retry = dialog.getByRole('button', {
      name: failStage === 'create' ? 'Retry same request' : 'Retry image upload', exact: true,
    })
    await expect(retry).toBeEnabled()
    await retry.click()
    await expect(page).toHaveURL(`/app/products/${productId}`)
    const attempts = writes.filter((write) => write.stage === failStage)
    expect(attempts).toHaveLength(2)
    expect(attempts[1]).toEqual(attempts[0])
    for (const stage of ['create', 'reservation', 'upload', 'association'].filter((stage) => stage !== failStage)) {
      expect(writes.filter((write) => write.stage === stage)).toHaveLength(1)
    }
  })
}

test('validate images, remove the preview, and create a product without an image', async ({ page }) => {
  const writes = await setup(page)
  const dialog = await fillProduct(page)
  const picker = dialog.locator('input[type="file"]')
  await picker.setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('notes') })
  await expect(dialog.getByRole('alert')).toContainText('Only JPG, PNG, WEBP accepted.')
  await picker.setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) })
  await expect(dialog.getByRole('alert')).toContainText('Maximum size is 10 MB.')
  await picker.setInputFiles(image)
  await dialog.getByRole('button', { name: 'Remove polo.png', exact: true }).click()
  await expect(dialog.getByRole('img')).toHaveCount(0)
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Create Product', exact: true }).click()
  await expect(page).toHaveURL(`/app/products/${productId}`)
  expect(writes.map((write) => write.stage)).toEqual(['create'])
})

test('an image dropped before entering product details is protected when closing', async ({ page }) => {
  const writes = await setup(page)
  const dialog = page.getByRole('dialog', { name: 'Create custom product', exact: true })
  await dialog.getByRole('button', { name: 'Add product image', exact: true }).evaluate((node, content) => {
    const transfer = new DataTransfer()
    transfer.items.add(new File([new Uint8Array(content)], 'polo.png', { type: 'image/png' }))
    node.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }))
  }, [...bytes])
  await expect(dialog.getByRole('img', { name: 'polo.png', exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click()
  const confirm = page.getByRole('dialog', { name: 'Discard changes?', exact: true })
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: 'Keep editing', exact: true }).click()
  await expect(dialog.getByRole('img', { name: 'polo.png', exact: true })).toBeVisible()
  expect(writes).toEqual([])
})

test('continue to the saved product when an image cannot be uploaded', async ({ page }) => {
  const writes = await setup(page, { failStage: 'reservation' })
  const dialog = await fillProduct(page)
  await dialog.locator('input[type="file"]').setInputFiles(image)
  await dialog.getByRole('button', { name: 'Create Product', exact: true }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: 'Product name', exact: true })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Continue to product', exact: true }).click()
  await expect(page).toHaveURL(`/app/products/${productId}`)
  expect(writes.map((write) => write.stage)).toEqual(['create', 'reservation'])
})

test('image uploads respect product editing permission', async ({ page }) => {
  const writes = await setup(page, { canEdit: false })
  const dialog = await fillProduct(page)
  await expect(dialog.getByRole('button', { name: 'Add product image', exact: true })).toHaveAttribute('aria-disabled', 'true')
  await expect(dialog.getByText('Product editing permission is required to upload images.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Create Product', exact: true }).click()
  await expect(page).toHaveURL(`/app/products/${productId}`)
  expect(writes.map((write) => write.stage)).toEqual(['create'])
})
