import { expect, test } from '@playwright/test'
import { mockSignedIn } from './helpers/auth'

const organizationId = '507f1f77bcf86cd799439011'
const base = `/api/v1/organizations/${organizationId}`
const allGrants = ['inquiries', 'clients', 'suppliers', 'products'].flatMap((area) => [`${area}.view`, `${area}.create`])

async function mockWorkspace(page, { grants = allGrants, writesAllowed = true } = {}) {
  await mockSignedIn(page)
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
  const leads = []
  const submissions = []
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const reply = (data) => route.fulfill({ json: { data } })
    if (path === '/api/v1/organizations') return reply({ items: [{ id: organizationId, name: 'Acme workspace', status: 'active' }], next: null })
    if (path.endsWith('/permissions')) return reply({ owner: false, grants: grants.map((key) => ({ key, scope: 'all' })) })
    if (path.endsWith('/access')) return reply({ writesAllowed, state: writesAllowed ? 'normal' : 'restricted' })
    if (path === `${base}/inquiries`) {
      if (request.method() === 'POST') {
        const payload = request.postDataJSON()
        submissions.push(payload)
        const lead = { _id: '507f1f77bcf86cd799439022', submitted: payload, stage: 'new', source: 'manual', createdAt: new Date().toISOString() }
        leads.push(lead)
        return reply({ type: 'inquiry', targetId: lead._id, revision: 0 })
      }
      return reply({ items: leads, next: null })
    }
    return reply({ items: [], next: null })
  })
  return { submissions }
}

test('global menu opens each creation modal without leaving the current page', async ({ page }) => {
  await mockWorkspace(page)
  await page.goto('/app/leads')
  for (const [option, title] of [['Add lead', 'Add lead'], ['Add client', 'Add client'], ['Add supplier', 'Add supplier'], ['Add product', 'Create custom product']]) {
    await page.getByRole('button', { name: 'Quick create', exact: true }).click()
    await page.getByRole('menuitem', { name: option, exact: true }).click()
    const dialog = page.getByRole('dialog', { name: title, exact: true })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('textbox').first()).toBeVisible()
    await expect(page).toHaveURL(/\/app\/leads$/)
    await expect(page.getByRole('menu')).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Quick create', exact: true })).toBeFocused()
  }
})

test('lead submission validates required fields and refreshes the current lead list', async ({ page }) => {
  const { submissions } = await mockWorkspace(page)
  await page.goto('/app/leads')
  await page.getByRole('button', { name: 'Quick create', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Add lead', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add lead', exact: true })
  await dialog.getByRole('button', { name: 'Add lead', exact: true }).click()
  expect(submissions).toHaveLength(0)
  await expect(dialog.getByLabel('Company name')).toHaveAttribute('aria-invalid', 'true')
  await dialog.getByLabel('Company name').fill('  Acme Studio  ')
  await dialog.getByLabel('Contact name').fill('Alex Smith')
  await dialog.getByLabel('Email address').fill('alex@example.com')
  await dialog.getByLabel('Requirement', { exact: true }).fill('100 branded shirts\nDelivery to Mumbai')
  await dialog.getByRole('button', { name: 'Add lead', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('cell', { name: 'Acme Studio', exact: true })).toBeVisible()
  expect(submissions).toEqual([{ companyName: 'Acme Studio', contactName: 'Alex Smith', email: 'alex@example.com', requirement: '100 branded shirts\nDelivery to Mumbai' }])
})

test('menu only includes permitted create actions', async ({ page }) => {
  await mockWorkspace(page, { grants: ['inquiries.view', 'clients.create'] })
  await page.goto('/app/leads')
  await page.getByRole('button', { name: 'Quick create', exact: true }).click()
  await expect(page.getByRole('menuitem')).toHaveText(['Add clientCreate a client relationship'])
})

test('an uncertain lead save retries the same request without losing the draft', async ({ page }) => {
  await mockWorkspace(page)
  const attempts = []
  await page.route(`**${base}/inquiries`, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    attempts.push({ payload: route.request().postDataJSON(), key: route.request().headers()['idempotency-key'] })
    if (attempts.length === 1) {
      return route.fulfill({ status: 503, json: { error: { message: 'Please retry this request.' } } })
    }
    return route.fallback()
  })
  await page.goto('/app/leads')
  await page.getByRole('button', { name: 'Quick create', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Add lead', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add lead', exact: true })
  await dialog.getByLabel('Company name').fill('Acme Studio')
  await dialog.getByLabel('Contact name').fill('Alex Smith')
  await dialog.getByLabel('Email address').fill('alex@example.com')
  await dialog.getByLabel('Requirement', { exact: true }).fill('100 branded shirts')
  await dialog.getByRole('button', { name: 'Add lead', exact: true }).click()
  await expect(dialog.getByLabel('Company name')).toBeDisabled()
  await page.getByRole('button', { name: 'Dismiss error', exact: true }).click()
  await dialog.getByRole('button', { name: 'Retry same request', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(attempts).toHaveLength(2)
  expect(attempts[1]).toEqual(attempts[0])
  expect(attempts[0].key).toBeTruthy()
})

for (const access of [{ name: 'read-only role', grants: ['inquiries.view'] }, { name: 'paused writes', writesAllowed: false }]) {
  test(`global create is hidden for ${access.name}`, async ({ page }) => {
    await mockWorkspace(page, access)
    await page.goto('/app/leads')
    await expect(page.getByRole('heading', { name: 'Leads', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Quick create', exact: true })).toHaveCount(0)
  })
}

test('keyboard navigation, Escape, and outside clicks dismiss the menu', async ({ page }) => {
  await mockWorkspace(page)
  await page.goto('/app/leads')
  const trigger = page.getByRole('button', { name: 'Quick create', exact: true })
  await trigger.focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitem', { name: 'Add lead', exact: true })).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await expect(page.getByRole('menuitem', { name: 'Add product', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await trigger.click()
  await page.getByRole('heading', { name: 'Leads', exact: true }).click()
  await expect(page.getByRole('menu')).toHaveCount(0)
})

for (const mode of ['light', 'dark']) {
  test(`mobile quick create menu and modal fit in ${mode} mode`, async ({ page }, testInfo) => {
    await mockWorkspace(page)
    await page.addInitScript((theme) => localStorage.setItem('theme', theme), mode)
    await page.setViewportSize({ width: 320, height: 812 })
    await page.goto('/app/leads')
    await page.getByRole('button', { name: 'Quick create', exact: true }).click()
    await expect(page.getByRole('menuitem')).toHaveCount(4)
    const bounds = await page.getByRole('menu').boundingBox()
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(320)
    await page.screenshot({ path: testInfo.outputPath(`quick-create-${mode}.png`) })
    await page.getByRole('menuitem', { name: 'Add lead', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Add lead', exact: true })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  })
}
