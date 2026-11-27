import { expect, test } from '@playwright/test'
import { mockSignedIn } from './helpers/auth'
import { contrastRatio } from './helpers/contrast'

const org = '507f1f77bcf86cd799439011'
const clientId = '507f1f77bcf86cd799439022'
const base = `/organizations/${org}/clients/${clientId}`
const company = 'Acme Studio with a long workspace name to check tooltip wrapping and viewport edges'

async function setup(page, mode) {
  await mockSignedIn(page)
  await page.addInitScript(theme => localStorage.setItem('theme', theme), mode)
  await page.route('https://fonts.googleapis.com/**', route => route.abort())
  await page.route('https://fonts.gstatic.com/**', route => route.abort())
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '')
    let data = { items: [], next: null }
    if (path === '/organizations') data = { items: [{ id: org, name: company, status: 'active' }] }
    else if (path.endsWith('/permissions')) data = {
      owner: true,
      grants: ['clients.view', 'clients.edit', 'contacts.view', 'contacts.edit'].map(key => ({ key, scope: key.endsWith('.add') ? 'none' : 'all' })),
    }
    else if (path.endsWith('/access')) data = { writesAllowed: true, state: 'normal' }
    else if (path === base) data = { _id: clientId, name: 'Acme Client', status: 'active', __v: 1 }
    else if (path === `${base}/addresses`) data = { items: [{
      id: 'incomplete', label: 'Warehouse', active: true, usage: 'shipping',
      readiness: { complete: false, missingFields: ['address.line1'] }, address: {},
    }] }
    return route.fulfill({ json: { data } })
  })
  await page.goto(`/app/clients/${clientId}`)
}

for (const mode of ['light', 'dark']) {
  for (const width of [375, 1440]) {
    test(`themed tooltips support focus, hover and disabled controls in ${mode} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await setup(page, mode)
      const visibleTip = page.getByRole('tooltip')
      const scope = page.locator('.app-topbar-scope')
      await scope.focus()
      await expect(visibleTip).toHaveText(company)
      await expect(scope).not.toHaveAttribute('title')
      expect(await contrastRatio(visibleTip)).toBeGreaterThanOrEqual(4.5)
      expect(await visibleTip.evaluate(node => node.matches(':popover-open'))).toBe(true)
      const box = await visibleTip.boundingBox()
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(width)
      expect(box.y).toBeGreaterThanOrEqual(0)
      await page.screenshot({ path: testInfo.outputPath('themed-tooltip.png') })
      await page.keyboard.press('Escape')
      await expect(visibleTip).toHaveCount(0)
      await expect(scope).toBeFocused()

      await page.getByRole('tab', { name: 'Contacts', exact: true }).click()
      const search = page.getByRole('searchbox', { name: 'Search contacts', exact: true })
      await search.focus()
      await expect(visibleTip).toHaveText('Name search is case-sensitive.')
      await expect(search).not.toHaveAttribute('title')
      await page.keyboard.press('Escape')
      await expect(visibleTip).toHaveCount(0)
      const searchAction = page.getByRole('button', { name: 'Search contacts', exact: true })
      await searchAction.hover()
      await expect(visibleTip).toHaveText('Search contacts')
      // Moving onto the hint keeps it visible, so it can be read at high zoom.
      await visibleTip.hover()
      await expect(visibleTip).toHaveText('Search contacts')
      await page.keyboard.press('Escape')

      await page.getByRole('tab', { name: 'Saved addresses', exact: true }).click()
      const disabled = page.getByRole('button', { name: 'Use for shipping', exact: true })
      await expect(disabled).toBeDisabled()
      await disabled.hover()
      await expect(visibleTip).toHaveText('Complete this address before setting it as a default.')
      await expect(disabled).not.toHaveAttribute('title')
      expect(errors).toEqual([])
    })
  }
}
