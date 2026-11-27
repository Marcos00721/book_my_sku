import { expect, test } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { mockSignedIn } from './helpers/auth'

const org = '507f1f77bcf86cd799439011'
const productId = '507f1f77bcf86cd799439033'
const coverId = '507f1f77bcf86cd799439044'
const variantId = '507f1f77bcf86cd799439055'
const otherId = '507f1f77bcf86cd799439066'
const root = `/organizations/${org}`
const path = `${root}/products/${productId}`
const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1EAAAAASUVORK5CYII=', 'base64')
const checksum = 'a'.repeat(64)

async function setup(page, { editable = true, archived = false, cleanupFails = false, brokenPreview = false, uploadFails = false } = {}) {
  const writes = []
  let cover = coverId
  let override = null
  let cleaned = false
  let uploaded = false
  let uploadAttempts = 0
  let revision = 3
  const product = () => ({
    id: productId, name: 'Classic polo', productCode: 'PRD-000001', revision,
    status: archived ? 'archived' : 'draft', configuration: { mode: 'unresolved', dimensions: [] },
    readiness: { activationBlockers: [], restoreBlockers: [] },
  })
  await mockSignedIn(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
  await page.route('https://images.example.test/**', (route) => brokenPreview
    ? route.fulfill({ status: 404 }) : route.fulfill({ contentType: 'image/png', body: bytes }))
  await page.route('**/api/v1/**', (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const name = url.pathname.replace('/api/v1', '')
    const reply = (data) => route.fulfill({ json: { data } })
    if (request.method() !== 'GET') {
      writes.push({ name, method: request.method(), body: name.endsWith('/content') ? request.postDataBuffer() : request.postDataJSON() })
      if (name.endsWith('/media/association')) {
        const body = request.postDataJSON()
        if (body.variantId) override = body.assetId
        else cover = body.assetId
        revision += 1
        return reply({ revision })
      }
      if (name.endsWith('/media/cleanup')) {
        if (cleanupFails && writes.filter((write) => write.name.endsWith('/cleanup')).length === 1) {
          return route.fulfill({ status: 503, json: { error: { message: 'Cleanup temporarily unavailable.' } } })
        }
        cleaned = true
        return reply({ removed: 1, failed: 0 })
      }
      if (name.endsWith('/media/intents')) return reply({ id: 'uploaded-asset', state: 'pending' })
      if (name.endsWith('/content')) {
        uploadAttempts += 1
        if (uploadFails && uploadAttempts === 1) {
          return route.fulfill({ status: 503, json: { error: { message: 'Please retry this upload.' } } })
        }
        uploaded = true
        return reply({ state: 'ready' })
      }
    }
    if (name === '/organizations') return reply({ items: [{ id: org, name: 'Acme', status: 'active' }] })
    if (name.endsWith('/permissions')) return reply({ grants: ['products.view', ...(editable ? ['products.edit'] : [])].map((key) => ({ key, scope: key.endsWith('.add') ? 'none' : 'all' })) })
    if (name.endsWith('/access') && !name.includes('/media/')) return reply({ writesAllowed: true })
    if (name === path) return reply(product())
    if (name === `${path}/variants`) return reply({ items: [{ id: variantId, partCode: 'BLUE-M' }], next: null })
    if (name === `${path}/media`) {
      const isVariant = Boolean(url.searchParams.get('variantId'))
      return reply({ revision, source: isVariant && override ? 'variant' : cover ? 'primary' : null,
        effectiveAssetId: (isVariant && override) || cover,
        items: [
          { id: coverId, state: 'ready', version: 2, sha256: checksum, size: 2048 },
          { id: otherId, state: 'ready', version: 1, sha256: 'b'.repeat(64) },
          ...(!cleaned ? [{ id: 'failed-asset', state: 'failed', version: 1, sha256: null }] : []),
          ...(uploaded ? [{ id: 'uploaded-asset', state: 'ready', version: 1, sha256: 'c'.repeat(64) }] : []),
        ],
      })
    }
    if (/\/media\/[^/]+\/access$/.test(name)) return reply({ url: 'https://images.example.test/polo.png', expiresInSeconds: 300 })
    return reply({ items: [], next: null })
  })
  await page.goto(`/app/products/${productId}`)
  await page.getByRole('tab', { name: 'Images', exact: true }).click()
  await expect(page.getByRole('table')).toBeVisible()
  return writes
}

function previewButton(page, id) {
  return page.getByRole('button', { name: `Preview Image ${id.slice(-6)}`, exact: true })
}

for (const width of [375, 1440]) {
  test(`compact layouts keep cover controls and the adjacent image target at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 })
    await setup(page)
    const row = page.getByRole('row').filter({ has: previewButton(page, coverId) })
    const controls = page.locator('.product-image-toolbar-controls')
    await expect(controls.getByRole('button', { name: 'Image target', exact: true })).toBeVisible()
    await expect(controls.getByRole('button', { name: 'Table', exact: true })).toBeVisible()
    const targetBounds = await controls.getByRole('button', { name: 'Image target', exact: true }).boundingBox()
    const switchBounds = await controls.locator('.product-image-view-switch').boundingBox()
    expect(targetBounds.x + targetBounds.width).toBeLessThanOrEqual(switchBounds.x)
    expect(Math.abs(targetBounds.y + targetBounds.height - switchBounds.y - switchBounds.height)).toBeLessThanOrEqual(6)
    await expect(page.getByRole('columnheader')).toHaveText(['Image', 'File size', 'Dimensions', 'Cover'])
    await expect(row.getByRole('cell')).toHaveCount(4)
    await expect(row).toContainText('2.0 KB')
    await expect(row).toContainText('1 × 1 px')
    await expect(row.getByRole('img')).toHaveCSS('object-fit', 'contain')
    await expect(row.locator('.product-image-thumb')).toHaveCSS('width', '48px')
    expect((await row.boundingBox()).height).toBeLessThanOrEqual(70)
    await expect(page.locator('.product-image-library')).not.toContainText(/Asset ID|SHA-256|Version|Format|Ready/)
    await expect(page.getByRole('row').filter({ has: previewButton(page, otherId) }).getByRole('button', { name: 'Set as cover', exact: true })).toBeEnabled()
    await page.screenshot({ path: testInfo.outputPath('images-table.png'), fullPage: true })
    await row.getByRole('button', { name: `Preview Image ${coverId.slice(-6)}` }).click()
    const preview = page.getByRole('dialog', { name: 'Image preview', exact: true })
    await expect(preview.getByRole('img')).toBeVisible()
    await preview.getByRole('button', { name: 'Close dialog', exact: true }).click()
    await page.getByRole('button', { name: 'Cards', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Cards', exact: true })).toHaveAttribute('aria-pressed', 'true')
    const card = page.getByRole('article', { name: `Image ${coverId.slice(-6)}`, exact: true })
    await expect(card).toContainText('2.0 KB')
    await expect(card).toContainText('1 × 1 px')
    await expect(card.locator('.product-image-thumb')).toHaveCSS('width', '64px')
    await expect(card.getByRole('button')).toHaveCount(1)
    expect((await card.boundingBox()).height).toBeLessThanOrEqual(160)
    await expect(card).not.toContainText(/Asset ID|SHA-256|Version|Format|Ready/)
    await expect(page.getByRole('article', { name: `Image ${otherId.slice(-6)}`, exact: true }).getByRole('button', { name: 'Set as cover', exact: true })).toBeEnabled()
    await page.screenshot({ path: testInfo.outputPath('images-cards.png'), fullPage: true })
    await expect(page.getByRole('button', { name: /Retry upload/ })).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await page.getByRole('button', { name: 'Table', exact: true }).click()
    await expect(row).toBeVisible()
  })
}

test('clearing a cover confirms the action and cleanup reports the actual removed count', async ({ page }) => {
  const writes = await setup(page)
  await previewButton(page, coverId).click()
  await page.getByRole('button', { name: /Clear cover/ }).click()
  const confirm = page.getByRole('dialog', { name: 'Clear cover image?', exact: true })
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(writes).toHaveLength(0)
  await page.getByRole('button', { name: /Clear cover/ }).click()
  await confirm.getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(page.getByText('Image source: No catalog image', { exact: true })).toBeVisible()
  expect(writes[0]).toEqual({ name: `${path}/media/association`, method: 'POST', body: { expectedRevision: 3, assetId: null } })
  await page.getByRole('dialog', { name: 'Image preview', exact: true }).getByRole('button', { name: 'Close dialog', exact: true }).click()
  await expect(previewButton(page, coverId)).toBeVisible()
  await page.getByRole('button', { name: 'Clean up unused images', exact: true }).click()
  await page.getByRole('dialog', { name: 'Clean up unused images?', exact: true }).getByRole('button', { name: 'Clean up', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '1 image removed.' })).toBeVisible()
  await expect(page.getByRole('row')).toHaveCount(3)
  expect(writes.at(-1)).toEqual({ name: `${path}/media/cleanup`, method: 'POST', body: {} })
  expect(writes.some((write) => write.method === 'DELETE')).toBe(false)
})

test('variant inheritance cannot clear the product cover, while an override can be assigned and cleared', async ({ page }) => {
  const writes = await setup(page)
  const target = page.getByRole('button', { name: 'Image target', exact: true })
  await target.click()
  await page.getByRole('option', { name: /BLUE-M/ }).click()
  await expect(page.getByText('Image source: Product cover image', { exact: true })).toBeVisible()
  await previewButton(page, coverId).click()
  await expect(page.getByRole('button', { name: /Clear override/ })).toHaveCount(0)
  await page.getByRole('dialog', { name: 'Image preview', exact: true }).getByRole('button', { name: 'Close dialog', exact: true }).click()
  await page.getByRole('row').filter({ has: previewButton(page, otherId) }).getByRole('button', { name: 'Set as cover', exact: true }).click()
  await expect.poll(() => writes.length).toBe(1)
  expect(writes[0].body).toEqual({ expectedRevision: 3, assetId: otherId, variantId })
  await expect(page.getByRole('table')).toBeVisible()
  await target.click()
  await page.getByRole('option', { name: /BLUE-M/ }).click()
  await previewButton(page, otherId).click()
  await page.getByRole('button', { name: /Clear override/ }).click()
  await page.getByRole('dialog', { name: 'Clear variant override?', exact: true }).getByRole('button', { name: 'Clear', exact: true }).click()
  await expect.poll(() => writes.length).toBe(2)
  expect(writes[1].body).toEqual({ expectedRevision: 4, assetId: null, variantId })
})

for (const view of ['Table', 'Cards']) {
  test(`set the product cover directly from the ${view.toLowerCase()} view`, async ({ page }) => {
    const writes = await setup(page)
    await page.getByRole('button', { name: view, exact: true }).click()
    const item = view === 'Table'
      ? page.getByRole('row').filter({ has: previewButton(page, otherId) })
      : page.getByRole('article', { name: `Image ${otherId.slice(-6)}`, exact: true })
    await item.getByRole('button', { name: 'Set as cover', exact: true }).click()
    await expect.poll(() => writes.length).toBe(1)
    expect(writes[0].body).toEqual({ expectedRevision: 3, assetId: otherId })
    await expect(item.getByText('Cover', { exact: true })).toBeVisible()
    await expect(item.getByRole('button', { name: 'Set as cover', exact: true })).toHaveCount(0)
  })
}

test('cleanup errors are visible and support retry', async ({ page }) => {
  await setup(page, { cleanupFails: true })
  await page.getByRole('button', { name: 'Clean up unused images', exact: true }).click()
  await page.getByRole('dialog', { name: 'Clean up unused images?', exact: true }).getByRole('button', { name: 'Clean up', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Cleanup temporarily unavailable.' })).toBeVisible()
  await page.getByRole('button', { name: 'Retry last action', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Cleanup completed.' })).toBeVisible()
  await expect(page.getByRole('row')).toHaveCount(3)
})

test('failed local uploads can retry from the card layout without reserving twice', async ({ page }) => {
  const writes = await setup(page, { uploadFails: true })
  await page.locator('.product-media input[type="file"]').setInputFiles({ name: 'polo.png', mimeType: 'image/png', buffer: bytes })
  await expect(page.getByRole('alert').filter({ hasText: 'Please retry this upload.' })).toBeVisible()
  await page.getByRole('button', { name: 'Cards', exact: true }).click()
  await page.getByRole('button', { name: 'Retry upload', exact: true }).click()
  await expect(page.getByRole('article')).toHaveCount(4)
  await expect(page.getByRole('button', { name: 'Retry upload', exact: true })).toHaveCount(0)
  expect(writes.filter((write) => write.name.endsWith('/intents'))).toHaveLength(1)
  const uploads = writes.filter((write) => write.name.endsWith('/content'))
  expect(uploads).toHaveLength(2)
  expect(uploads[1].body).toEqual(uploads[0].body)
})

for (const options of [{ editable: false }, { archived: true }]) {
  test(`read-only library supports both views without exposing mutations: ${JSON.stringify(options)}`, async ({ page }) => {
    const writes = await setup(page, options)
    await expect(page.getByRole('button', { name: 'Upload product images', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Set as cover|Clear cover|Clean up unused/ })).toHaveCount(0)
    await page.getByRole('button', { name: 'Cards', exact: true }).click()
    await expect(page.getByRole('article')).toHaveCount(3)
    expect(writes).toEqual([])
  })
}

test('broken private previews fall back to an icon without losing metadata', async ({ page }) => {
  await setup(page, { brokenPreview: true })
  await expect(page.locator('.product-image-thumb img')).toHaveCount(0)
  await expect(page.getByRole('row').filter({ has: previewButton(page, coverId) })).toContainText('2.0 KB')
  await expect(page.getByRole('button', { name: `Preview Image ${coverId.slice(-6)}`, exact: true })).toBeDisabled()
})
