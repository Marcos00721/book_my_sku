import { expect, test } from '@playwright/test'
import { mockSignedIn } from './helpers/auth'
import { contrastRatio } from './helpers/contrast'

const initialPlan = { version: 2, unitAmountMinor: 4900, currency: 'usd', interval: 'month', unit: 'seat', createdAt: '2026-11-20T10:00:00Z' }
const firstChange = { id: '507f1f77bcf86cd799439001', action: 'plan.created', before: { ...initialPlan, version: 1, unitAmountMinor: 3900 }, after: initialPlan, reason: 'Updated base pricing', occurredAt: initialPlan.createdAt }

async function setup(page, { theme = 'light', conflict = false, uncertain = false, paginate = false, failPlan = false, failHistory = false, empty = false } = {}) {
  await mockSignedIn(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(value => localStorage.setItem('theme', value), theme)
  await page.route('https://fonts.googleapis.com/**', route => route.abort())
  await page.route('https://fonts.gstatic.com/**', route => route.abort())
  let plan = structuredClone(initialPlan)
  const changes = empty ? [] : [structuredClone(firstChange)]
  const writes = []
  const historyReads = []
  await page.route('**/api/v1/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace('/api/v1', '')
    let data = { items: [] }
    if (path === '/admin/me') data = { role: 'super_admin' }
    if (path === '/admin/plan') {
      if (failPlan) return route.fulfill({ status: 503, json: { error: { message: 'Plan service unavailable' } } })
      data = { plan }
    }
    if (path === '/admin/plan/history') {
      historyReads.push(url.searchParams.get('after'))
      if (failHistory) return route.fulfill({ status: 503, json: { error: { message: 'History service unavailable' } } })
      data = paginate ? url.searchParams.has('after') ? { items: [{ ...firstChange, id: '507f1f77bcf86cd799439002', reason: 'Second history page' }], nextCursor: null } : { items: changes, nextCursor: firstChange.id } : { items: changes, nextCursor: null }
    }
    if (path === '/admin/plan/versions') {
      const body = request.postDataJSON()
      writes.push({ body, key: request.headers()['idempotency-key'] })
      if (conflict && writes.length === 1) {
        plan = { ...plan, version: 3, unitAmountMinor: 5500 }
        return route.fulfill({ status: 409, json: { error: { code: 'ADMIN_RECORD_CHANGED', message: 'The plan has changed' } } })
      }
      if (uncertain && writes.length === 1) return route.fulfill({ status: 503, json: { error: { message: 'Response interrupted' } } })
      const before = plan
      plan = { ...plan, version: plan.version + 1, unitAmountMinor: body.unitAmountMinor }
      changes.push({ ...firstChange, id: '507f1f77bcf86cd799439003', before, after: plan, reason: body.reason })
      data = { before, after: plan }
    }
    await route.fulfill({ json: { data } })
  })
  return { writes, historyReads }
}

for (const theme of ['light', 'dark']) {
  for (const width of [390, 1440]) {
    test(`standard plan and editor fit ${width}px in ${theme}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 })
      await setup(page, { theme })
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto('/admin?section=plan')
      const current = page.getByRole('region', { name: 'Current standard plan' })
      await expect(current).toContainText('$49.00')
      await expect(current).toContainText('Version 2')
      const history = page.getByRole('region', { name: 'Version history' })
      await expect(history).toContainText('Previously $39.00')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      expect(await contrastRatio(current.locator('.standard-plan-badge'))).toBeGreaterThanOrEqual(4.5)
      await page.screenshot({ path: testInfo.outputPath(`standard-plan-${theme}-${width}.png`), fullPage: true })
      await page.getByRole('button', { name: 'Create a new plan version' }).click()
      const dialog = page.getByRole('dialog', { name: 'Create a plan version' })
      await expect(dialog.getByLabel('Price per seat / month (USD)', { exact: true })).toBeFocused()
      await expect(dialog.getByRole('button', { name: 'Create plan version', exact: true })).toBeInViewport()
      expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath(`standard-plan-editor-${theme}-${width}.png`), fullPage: true })
      expect(errors).toEqual([])
    })
  }
}

test('dollar entry validates cents and saves a revision-checked version with refreshed history', async ({ page }) => {
  const { writes, historyReads } = await setup(page)
  await page.goto('/admin?section=plan')
  await page.getByRole('button', { name: 'Create a new plan version' }).click()
  const dialog = page.getByRole('dialog')
  const price = dialog.getByLabel('Price per seat / month (USD)', { exact: true })
  const reason = dialog.getByLabel('Reason for change', { exact: true })
  const save = dialog.getByRole('button', { name: 'Create plan version', exact: true })
  await expect(save).toBeDisabled()
  await reason.fill('   ')
  await expect(save).toBeDisabled()
  await reason.fill(' Annual price review ')
  for (const invalid of ['', '0', '-1', '1.001', '1e2', '1000000.01', 'words']) {
    await price.fill(invalid)
    await expect(save).toBeDisabled()
  }
  await price.fill('0.01')
  await expect(save).toBeEnabled()
  await price.fill('1000000.00')
  await expect(save).toBeEnabled()
  await price.fill('59.29')
  await expect(dialog.locator('.standard-plan-comparison')).toContainText('$59.29')
  expect(writes).toEqual([])
  await save.click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'New plan version created' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Current standard plan' })).toContainText('$59.29')
  await expect(page.getByRole('region', { name: 'Version history' })).toContainText('Annual price review')
  expect(writes).toHaveLength(1)
  expect(writes[0].body).toEqual({ expectedVersion: 2, unitAmountMinor: 5929, reason: 'Annual price review' })
  expect(writes[0].key).toMatch(/^[\da-f-]{36}$/)
  expect(historyReads.length).toBeGreaterThan(1)
})

test('conflicts preserve the draft and require loading the latest version before saving', async ({ page }) => {
  const { writes } = await setup(page, { conflict: true })
  await page.goto('/admin?section=plan')
  await page.getByRole('button', { name: 'Create a new plan version' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Price per seat / month (USD)', { exact: true }).fill('59.00')
  await dialog.getByLabel('Reason for change', { exact: true }).fill('Pricing update')
  const save = dialog.getByRole('button', { name: 'Create plan version', exact: true })
  await save.click()
  await expect(save).toBeDisabled()
  await dialog.getByRole('button', { name: 'Load latest plan', exact: true }).click()
  await expect(dialog.locator('.standard-plan-comparison')).toContainText('Version 3')
  await expect(dialog.locator('.standard-plan-comparison')).toContainText('$55.00')
  await expect(dialog.getByLabel('Reason for change', { exact: true })).toHaveValue('Pricing update')
  await expect(dialog.getByLabel('Price per seat / month (USD)', { exact: true })).toHaveValue('59.00')
  await save.click()
  await expect(dialog).toHaveCount(0)
  expect(writes[1].body.expectedVersion).toBe(3)
})

test('uncertain saves lock the draft and retry the same idempotent request', async ({ page }) => {
  const { writes } = await setup(page, { uncertain: true })
  await page.goto('/admin?section=plan')
  await page.getByRole('button', { name: 'Create a new plan version' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Reason for change', { exact: true }).fill('Price confirmed')
  await dialog.getByRole('button', { name: 'Create plan version', exact: true }).click()
  await expect(dialog.getByLabel('Reason for change', { exact: true })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Retry same request', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(writes).toHaveLength(2)
  expect(writes[1]).toEqual(writes[0])
})

test('history paginates with server cursors and returns to the first page', async ({ page }) => {
  const { historyReads } = await setup(page, { paginate: true })
  await page.goto('/admin?section=plan')
  const history = page.getByRole('region', { name: 'Version history' })
  await expect(history).toContainText('Updated base pricing')
  await history.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(history).toContainText('Second history page')
  await expect(history.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
  await history.getByRole('button', { name: 'Previous', exact: true }).click()
  await expect(history).toContainText('Updated base pricing')
  expect(historyReads).toEqual([null, firstChange.id, null])
})

test('clear resets the price and reason without saving', async ({ page }) => {
  const { writes } = await setup(page)
  await page.goto('/admin?section=plan')
  await page.getByRole('button', { name: 'Create a new plan version' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Price per seat / month (USD)', { exact: true }).fill('79')
  await dialog.getByLabel('Reason for change', { exact: true }).fill('Draft')
  await dialog.getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(dialog.getByLabel('Price per seat / month (USD)', { exact: true })).toHaveValue('49.00')
  await expect(dialog.getByLabel('Reason for change', { exact: true })).toHaveValue('')
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(writes).toEqual([])
})

test('empty history has an explicit state', async ({ page }) => {
  await setup(page, { empty: true })
  await page.goto('/admin?section=plan')
  await expect(page.getByRole('heading', { name: 'No plan changes yet' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Version history' }).getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
})

test('failed reads offer recovery and do not expose a create action', async ({ page }) => {
  await setup(page, { failPlan: true, failHistory: true })
  await page.goto('/admin?section=plan')
  await expect(page.getByRole('heading', { name: 'Plan unavailable', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reload plan', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'History unavailable', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create a new plan version' })).toHaveCount(0)
})
