import { expect, test } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { mockSignedIn } from './helpers/auth'

const org = '507f1f77bcf86cd799439011'
const root = `/organizations/${org}`
const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1EAAAAASUVORK5CYII=', 'base64')

const products = [
  { id: 'cover', name: 'Classic Polo' },
  { id: 'library', name: 'Festival Wristband' },
  { id: 'empty', name: '  Navy   Mug  ' },
  { id: 'broken', name: 'Broken Photo' },
  { id: 'unavailable', name: 'Unavailable Asset' },
  { id: 'unsafe', name: 'Unsafe Link' },
].map((product, index) => ({
  ...product, productCode: `PRD-${index}`, status: 'draft', revision: 1,
}))

async function setup(page, items = products) {
  const mediaReads = []
  const accessReads = []
  await mockSignedIn(page)
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
  await page.route('https://images.example.test/**', (route) => {
    return route.request().url().includes('/broken')
      ? route.fulfill({ status: 404 })
      : route.fulfill({ contentType: 'image/png', body: bytes })
  })
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '')
    const reply = (data) => route.fulfill({ json: { data } })
    if (path === '/organizations') return reply({ items: [{ id: org, name: 'Acme', status: 'active' }] })
    if (path === `${root}/permissions`) return reply({ grants: [{ key: 'products.view', scope: 'all' }] })
    if (path === `${root}/access`) return reply({ writesAllowed: false })
    if (path === `${root}/products`) return reply({ items, next: null })
    const match = path.match(/\/products\/([^/]+)\/media(?:\/([^/]+)\/access)?$/)
    if (match) {
      const [, id, assetId] = match
      if (assetId) {
        accessReads.push({ id, assetId })
        return reply({
          url: `${id === 'unsafe' ? 'http' : 'https'}://images.example.test/${id}.png?token=${accessReads.length}`,
          expiresInSeconds: 300,
        })
      }
      mediaReads.push(id)
      if (id === 'unavailable') return route.fulfill({ status: 503, json: { error: { message: 'Images temporarily unavailable' } } })
      return reply({
        // The primary cover wins even when other ready assets come first.
        effectiveAssetId: id === 'cover' ? 'primary-cover' : null,
        items: id === 'empty' || id.startsWith('page-') ? [] : [
          { id: 'processing-image', state: 'pending' },
          { id: 'library-image', state: 'ready' },
        ],
      })
    }
    return reply({ items: [], next: null })
  })
  await page.goto('/app/products')
  return { mediaReads, accessReads }
}

for (const width of [375, 1440]) {
  test(`product listing shows thumbnails or name initials at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const { mediaReads, accessReads } = await setup(page)
    const row = (name) => page.getByRole('row').filter({ has: page.getByRole('link', { name, exact: true }) })
    const cover = row('Classic Polo').locator('.product-list-thumbnail img')
    await expect(cover).toBeVisible()
    await expect(cover).toHaveJSProperty('naturalWidth', 1)
    await expect(cover).toHaveCSS('width', '32px')
    await expect(row('Festival Wristband').locator('.product-list-thumbnail img')).toBeVisible()
    await expect.poll(() => mediaReads.length).toBe(products.length)
    await expect(row('Navy Mug').locator('.product-list-thumbnail')).toHaveText('NM')
    await expect(row('Broken Photo').locator('.product-list-thumbnail')).toHaveText('BP')
    await expect(row('Unavailable Asset').locator('.product-list-thumbnail')).toHaveText('UA')
    await expect(row('Unsafe Link').locator('.product-list-thumbnail')).toHaveText('UL')
    expect(accessReads).toContainEqual({ id: 'cover', assetId: 'primary-cover' })
    expect(accessReads).toContainEqual({ id: 'library', assetId: 'library-image' })
    expect(accessReads.some(({ id }) => id === 'empty')).toBe(false)
    await expect(page.locator('main .entity-icon')).toHaveCount(0)
    await expect(row('Classic Polo').getByRole('link', { name: 'Classic Polo', exact: true })).toHaveAttribute('href', '/app/products/cover')
  })
}

test('load media only for the current listing page', async ({ page }) => {
  const items = Array.from({ length: 26 }, (_, index) => ({
    id: `page-${index}`, name: `Product ${index}`, productCode: `PRD-${index}`, status: 'draft', revision: 1,
  }))
  const { mediaReads } = await setup(page, items)
  await expect.poll(() => mediaReads.length).toBe(25)
  expect(mediaReads).not.toContain('page-25')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect.poll(() => mediaReads.length).toBe(26)
  expect(mediaReads).toContain('page-25')
  await expect(page.locator('.product-list-thumbnail')).toHaveCount(1)
})

test('renew expiring private thumbnail links', async ({ page }) => {
  await page.clock.install()
  const { accessReads } = await setup(page, [products[0]])
  const thumbnail = page.locator('.product-list-thumbnail img')
  await expect(thumbnail).toHaveAttribute('src', /token=1$/)
  await page.clock.fastForward(295000)
  await expect(thumbnail).toHaveAttribute('src', /token=2$/)
  expect(accessReads).toHaveLength(2)
})
