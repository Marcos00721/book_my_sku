import { expect, test } from '@playwright/test'
import { mockSignedIn } from './helpers/auth'

const organizationId = '507f1f77bcf86cd799439011'
const base = `/api/v1/organizations/${organizationId}`

async function mockWorkspace(page, { failList = false } = {}) {
  await mockSignedIn(page)
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
  let listFailure = failList
  let submissions = 0
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const reply = (data) => route.fulfill({ json: { data } })
    if (path === '/api/v1/organizations') return reply({ items: [{ id: organizationId, name: 'Acme workspace', status: 'active' }], next: null })
    if (path.endsWith('/permissions')) return reply({ owner: false, grants: ['inquiries.view', 'inquiries.add'].map((key) => ({ key, scope: key.endsWith('.add') ? 'none' : 'all' })) })
    if (path.endsWith('/access')) return reply({ writesAllowed: true, state: 'normal' })
    if (path === `${base}/inquiries`) {
      if (request.method() === 'POST') {
        submissions += 1
        return route.fulfill({ status: 422, json: { error: { message: 'This company already has a lead.', code: 'VALIDATION_FAILED', requestId: 'lead-support-ref', fields: [{ field: 'companyName', message: 'Use a different company name.' }] } } })
      }
      if (listFailure) {
        return route.fulfill({ status: 503, json: { error: { message: 'Could not load leads. Please try again.', code: 'TEMPORARY_ERROR' } } })
      }
      return reply({ items: [], next: null })
    }
    return reply({ items: [], next: null })
  })
  return { submissions: () => submissions, recover: () => { listFailure = false } }
}

test('list failure appears in a snackbar and retry clears it', async ({ page }) => {
  const state = await mockWorkspace(page, { failList: true })
  await page.goto('/app/leads')
  const snackbar = page.locator('.app-snackbar')
  await expect(snackbar).toBeVisible()
  await expect(snackbar).toContainText('Could not load leads. Please try again.')
  state.recover()
  await snackbar.getByRole('button', { name: 'Reload latest data' }).click()
  await expect(snackbar).toHaveCount(0)
  await expect(page.getByText('No leads yet', { exact: true })).toBeVisible()
})

for (const theme of ['light', 'dark']) {
  test(`modal errors remain interactive and fit on mobile in ${theme} mode`, async ({ page }, testInfo) => {
    const state = await mockWorkspace(page, { failList: true })
    await page.addInitScript((value) => localStorage.setItem('theme', value), theme)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/app/leads')
    await expect(page.locator('.app-snackbar')).toBeVisible()
    await page.getByRole('button', { name: 'Quick create', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Add lead', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Add lead', exact: true })
    await dialog.getByLabel('Company name').fill('Acme Studio')
    await dialog.getByLabel('Contact name').fill('Alex Smith')
    await dialog.getByLabel('Email address').fill('alex@example.com')
    await dialog.getByLabel('Requirement', { exact: true }).fill('100 branded shirts')
    await dialog.getByRole('button', { name: 'Add lead', exact: true }).click()
    const snackbar = dialog.locator('.app-snackbar')
    await expect(snackbar).toBeVisible()
    await expect(snackbar).toContainText('This company already has a lead.')
    await expect(snackbar).toContainText('Support reference: lead-support-ref')
    await expect(dialog.getByLabel('Company name')).toHaveAttribute('aria-invalid', 'true')
    await expect(dialog.getByLabel('Company name')).toHaveValue('Acme Studio')
    const bounds = await snackbar.boundingBox()
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(375)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(812)
    const positions = await page.locator('.app-snackbar').evaluateAll((nodes) => nodes.map((node) => {
      const rect = node.getBoundingClientRect()
      return { top: rect.top, bottom: rect.bottom }
    }))
    positions.sort((a, b) => a.top - b.top)
    expect(positions[0].bottom).toBeLessThanOrEqual(positions[1].top)
    await page.screenshot({ path: testInfo.outputPath(`snackbar-${theme}.png`) })
    await snackbar.getByRole('button', { name: 'Dismiss error' }).click()
    await expect(snackbar).toHaveCount(0)
    expect(state.submissions()).toBe(1)
    await expect(dialog.getByRole('button', { name: 'Add lead', exact: true })).toBeFocused()
    await dialog.getByLabel('Company name').fill('Another company')
    await dialog.getByRole('button', { name: 'Add lead', exact: true }).click()
    await expect(snackbar).toBeVisible()
    expect(state.submissions()).toBe(2)
  })
}
