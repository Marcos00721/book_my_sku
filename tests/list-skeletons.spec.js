import { expect, test } from '@playwright/test'
import { mockSignedIn } from './helpers/auth'

const organizationId = '507f1f77bcf86cd799439011'
const base = `/organizations/${organizationId}`
const grants = ['clients.view', 'suppliers.view', 'products.view', 'master_data.view']
  .map((key) => ({ key, scope: 'all' }))

async function mockWorkspace(page, respond) {
  await mockSignedIn(page)
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '')
    const reply = (data) => route.fulfill({ json: { data } })
    if (await respond({ path, route, reply })) return
    if (path === '/admin/me') return reply({ role: 'super_admin' })
    if (path === '/organizations') {
      return reply({ items: [{ id: organizationId, name: 'Test workspace', status: 'active', owner: true }], next: null })
    }
    if (path.endsWith('/permissions')) return reply({ owner: true, organizationId, grants })
    if (path.endsWith('/access')) return reply({ state: 'normal', writesAllowed: true, nextAction: 'none' })
    return reply({ items: [], next: null })
  })
}

const listings = [
  { url: '/app/clients', endpoint: `${base}/clients`, label: 'Loading clients…', columns: 4, empty: 'No clients yet' },
  { url: '/app/suppliers', endpoint: `${base}/suppliers`, label: 'Loading suppliers…', columns: 5, empty: 'No suppliers yet' },
  { url: '/app/products', endpoint: `${base}/products`, label: 'Loading products…', columns: 7, empty: 'No custom products yet' },
  { url: '/app/master-data', endpoint: `${base}/master-data/industry`, label: 'Loading reference lists…', columns: 5 },
  { url: '/app/decoration-matrices', endpoint: `${base}/decoration-matrices`, label: 'Loading decoration matrices…', columns: 4 },
  { url: '/app/team', endpoint: `${base}/members`, label: 'Loading workspace members…', columns: 4 },
  { url: '/app/roles', endpoint: `${base}/roles`, label: 'Loading roles…', columns: 4 },
  { url: '/admin?section=applications', endpoint: '/admin/applications', label: 'Loading applications…', columns: 4 },
  { url: '/admin?section=registrations', endpoint: '/admin/registration-intakes', label: 'Loading registrations…', columns: 5 },
  { url: '/admin?section=assisted', endpoint: '/admin/assisted', label: 'Loading assisted offers…', columns: 6 },
  { url: '/admin?section=catalog', endpoint: '/admin/permissions', label: 'Loading permissions…' },
  { url: '/admin?section=masterData', endpoint: '/admin/master-data/draft', label: 'Loading the platform template…', columns: 5, data: { revision: 0, version: 0, entries: [] } },
]

for (const listing of listings) {
  test(`${listing.url} shows skeletons until its list response arrives`, async ({ page }) => {
    let release
    let requestStarted
    const pending = new Promise((resolve) => { release = resolve })
    const requested = new Promise((resolve) => { requestStarted = resolve })
    await mockWorkspace(page, async ({ path, reply }) => {
      if (path !== listing.endpoint) return false
      requestStarted()
      await pending
      await reply(listing.data || { items: [], next: null })
      return true
    })

    try {
      await page.goto(listing.url)
      await requested
      const skeleton = page.locator('.list-skeleton').filter({ hasText: listing.label })
      await expect(skeleton).toBeVisible()
      await expect(skeleton).toHaveAttribute('role', 'status')
      await expect(skeleton).toHaveAttribute('aria-busy', 'true')
      if (listing.columns) {
        await expect(skeleton.locator('thead th')).toHaveCount(listing.columns)
        await expect(skeleton.locator('tbody tr')).toHaveCount(6)
        // Placeholders must not appear as real, actionable records to screen readers.
        await expect(skeleton.getByRole('table')).toHaveCount(0)
      }
      if (listing.empty) await expect(page.getByRole('heading', { name: listing.empty, exact: true })).toHaveCount(0)
      release()
      await expect(skeleton).toHaveCount(0)
      if (listing.empty) await expect(page.getByRole('heading', { name: listing.empty, exact: true })).toBeVisible()
    } finally {
      release()
    }
  })
}

test('client refresh shows skeletons, then exposes a failed request without an empty state', async ({ page }) => {
  let release
  let requests = 0
  const pending = new Promise((resolve) => { release = resolve })
  await mockWorkspace(page, async ({ path, route, reply }) => {
    if (path !== `${base}/clients`) return false
    requests++
    if (requests === 1) {
      await reply({ items: [{ _id: '507f1f77bcf86cd799439021', name: 'Existing client', status: 'active' }], next: null })
    } else {
      await pending
      await route.fulfill({ status: 500, json: { error: { code: 'INTERNAL_ERROR', message: 'Could not load clients.' } } })
    }
    return true
  })
  try {
    await page.goto('/app/clients')
    await expect(page.getByRole('link', { name: 'Existing client', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Refresh clients' }).click()
    const skeleton = page.locator('.list-skeleton').filter({ hasText: 'Loading clients…' })
    await expect(skeleton).toBeVisible()
    release()
    await expect(skeleton).toHaveCount(0)
    await expect(page.getByRole('alert')).toContainText('Could not load clients.')
    await expect(page.getByRole('heading', { name: 'No clients yet', exact: true })).toHaveCount(0)
  } finally {
    release()
  }
})

test('product skeletons fit a mobile viewport and respect reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  let release
  const pending = new Promise((resolve) => { release = resolve })
  await mockWorkspace(page, async ({ path, reply }) => {
    if (path !== `${base}/products`) return false
    await pending
    await reply({ items: [], next: null })
    return true
  })
  try {
    await page.goto('/app/products')
    const skeleton = page.locator('.list-skeleton').filter({ hasText: 'Loading products…' })
    await expect(skeleton).toBeVisible()
    await expect(skeleton.locator('.list-skeleton-thumbnail')).toHaveCount(6)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    const animation = await skeleton.locator('.motion-safe\\:animate-pulse').first()
      .evaluate((element) => getComputedStyle(element).animationName)
    expect(animation).toBe('none')
  } finally {
    release()
  }
})
