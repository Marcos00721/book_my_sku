import { expect, test } from '@playwright/test'
import { mockSignedIn } from './helpers/auth'

const org = '507f1f77bcf86cd799439011'
const supplierId = '507f1f77bcf86cd799439022'
const supplierPath = `/organizations/${org}/suppliers/${supplierId}`

for (const mode of ['light', 'dark']) {
  for (const width of [375, 1440]) {
    test(`scrolling activity stays hidden behind the header in ${mode} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await mockSignedIn(page)
      await page.addInitScript((theme) => localStorage.setItem('theme', theme), mode)
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
            grants: ['suppliers.view', 'suppliers.edit', 'suppliers.history.view'].map((key) => ({ key, scope: 'all' })),
          }
        } else if (path.endsWith('/access')) {
          data = { writesAllowed: true, state: 'normal' }
        } else if (path === supplierPath) {
          data = { _id: supplierId, name: 'Acme Supply', status: 'active', capabilities: ['supplier'], revision: 1 }
        } else if (path === `${supplierPath}/activity`) {
          data = {
            items: Array.from({ length: 12 }, (_, index) => ({
              id: `event-${index}`,
              action: 'supplier.updated',
              occurredAt: '2026-11-16T08:00:00Z',
              actor: { displayName: 'Alex', membershipStatus: 'current' },
              entity: { type: 'supplier', id: supplierId },
              changes: [
                { field: 'name', before: `Previous supplier ${index}`, after: `Updated supplier ${index}` },
                { field: 'email', before: 'old@example.com', after: 'orders@example.com' },
              ],
            })),
            next: null,
          }
        }
        return route.fulfill({ json: { data } })
      })

      await page.goto(`/app/suppliers/${supplierId}`)
      await page.getByRole('tab', { name: 'Activity', exact: true }).click()
      await expect(page.locator('.activity-timeline-card')).toHaveCount(12)
      await page.evaluate(() => document.fonts.ready)
      const region = page.locator('.app-topbar-region')
      const bar = page.getByRole('banner')
      const initialBar = await bar.boundingBox()
      const regionBox = await region.boundingBox()
      const clip = {
        x: Math.ceil(regionBox.x),
        y: 0,
        width: Math.floor(regionBox.width),
        height: Math.floor(regionBox.height),
      }
      const initial = await page.screenshot({ clip, animations: 'disabled' })

      for (const distance of [350, 950, 1700]) {
        await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), distance)
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(distance)
        const scrolledBar = await bar.boundingBox()
        expect(scrolledBar.y).toBe(initialBar.y)
        const pinnedHeading = await page.locator('.sticky-page-chrome').boundingBox()
        expect(pinnedHeading.y).toBeCloseTo(regionBox.height, 0)
        const scrolled = await page.screenshot({ clip, animations: 'disabled' })
        expect(scrolled.equals(initial), 'The header and its surrounding gaps must not reveal scrolling content').toBe(true)
      }

      await page.screenshot({ path: testInfo.outputPath('scrolled-activity.png') })
      await page.getByRole('tab', { name: 'Contacts', exact: true }).click()
      await expect(page.getByRole('tabpanel', { name: 'Contacts', exact: true })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    })
  }
}
