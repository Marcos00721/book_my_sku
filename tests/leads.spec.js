import { expect, test } from '@playwright/test'
import { mockSignedIn } from './helpers/auth'

const organizationId = '507f1f77bcf86cd799439011'
const endpoint = `/api/v1/organizations/${organizationId}/inquiries`
const next = {
  createdAt: '2026-11-19T12:00:00.000Z',
  id: '507f1f77bcf86cd799439022',
  scope: 'a'.repeat(64),
}
const lead = {
  _id: '507f1f77bcf86cd799439022',
  submitted: { companyName: 'Original company' },
  corrections: { companyName: 'Acme Studio' },
  stage: 'reviewing',
  source: 'manual',
  revision: 2,
  createdAt: '2026-11-19T12:00:00.000Z',
}

async function mockWorkspace(page, { allowed = true, writesAllowed = true, respond } = {}) {
  const requests = []
  await mockSignedIn(page)
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    const reply = (data) => route.fulfill({ json: { data } })
    if (url.pathname === '/api/v1/organizations')
      return reply({ items: [{ id: organizationId, name: 'Acme workspace', status: 'active' }], next: null })
    if (url.pathname.endsWith('/permissions'))
      return reply({ owner: true, grants: allowed ? [{ key: 'inquiries.view', scope: 'all' }] : [] })
    if (url.pathname.endsWith('/access')) return reply({ writesAllowed, state: writesAllowed ? 'normal' : 'restricted' })
    if (url.pathname === endpoint) {
      requests.push(url)
      return respond ? respond({ route, url, reply }) : reply({ items: [lead], next: null })
    }
    return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Route not found' } } })
  })
  return requests
}

test('Leads sidebar opens the real inquiry list and prefers corrected company names', async ({ page }) => {
  const requests = await mockWorkspace(page)
  await page.goto('/app')
  const nav = page.getByRole('navigation', { name: 'Workspace navigation' })
  await nav.getByRole('link', { name: 'Leads', exact: true }).click()
  await expect(page).toHaveURL(/\/app\/leads$/)
  await expect(nav.getByRole('link', { name: 'Leads', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('heading', { name: 'Leads', exact: true })).toBeVisible()
  const table = page.getByRole('table')
  await expect(table.getByRole('columnheader')).toHaveText(['Company', 'Stage', 'Source', 'Created'])
  await expect(table.getByRole('cell', { name: 'Acme Studio' })).toBeVisible()
  await expect(table.getByText('Original company')).toHaveCount(0)
  await expect(table.getByRole('cell', { name: 'Reviewing', exact: true })).toBeVisible()
  await expect(table.getByRole('cell', { name: 'Staff entry', exact: true })).toBeVisible()
  expect(requests[0].searchParams.get('limit')).toBe('25')
  await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
})

test('pagination sends JSON before cursors and search and stage changes reset pagination', async ({ page }) => {
  const requests = await mockWorkspace(page, {
    respond: ({ url, reply }) => reply({
      items: [{ ...lead, corrections: { companyName: url.searchParams.has('before') ? 'Older company' : 'Acme Studio' } }],
      next: url.searchParams.has('before') ? null : next,
    }),
  })
  await page.goto('/app/leads')
  const nextButton = page.getByRole('button', { name: 'Next', exact: true })
  await nextButton.click()
  await expect(page.getByRole('cell', { name: 'Older company' })).toBeVisible()
  expect(JSON.parse(requests.at(-1).searchParams.get('before'))).toEqual(next)
  await page.getByRole('button', { name: 'Previous', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'Acme Studio' })).toBeVisible()
  expect(requests.at(-1).searchParams.has('before')).toBe(false)
  await nextButton.click()
  await expect(page.getByRole('cell', { name: 'Older company' })).toBeVisible()
  await page.getByRole('button', { name: 'Lead stage', exact: true }).click()
  await page.getByRole('option', { name: 'Qualified', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'Acme Studio' })).toBeVisible()
  expect(requests.at(-1).searchParams.get('stage')).toBe('qualified')
  expect(requests.at(-1).searchParams.has('before')).toBe(false)
  await nextButton.click()
  await expect(page.getByRole('cell', { name: 'Older company' })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search leads' }).fill('  Acme & Co  ')
  await expect.poll(() => requests.at(-1)?.searchParams.get('search')).toBe('Acme & Co')
  await expect(page.getByRole('cell', { name: 'Acme Studio' })).toBeVisible()
  expect(requests.at(-1).searchParams.has('before')).toBe(false)
  expect(requests.at(-1).searchParams.get('stage')).toBe('qualified')
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  await expect.poll(() => requests.at(-1)?.searchParams.has('search')).toBe(false)
  expect(requests.at(-1).searchParams.has('stage')).toBe(false)
  expect(requests.at(-1).searchParams.has('before')).toBe(false)
})

test('permission denial hides Leads and prevents inquiry requests even for an owner', async ({ page }) => {
  const requests = await mockWorkspace(page, { allowed: false })
  await page.goto('/app/leads')
  await expect(page.getByRole('heading', { name: 'Access is limited' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Leads', exact: true })).toHaveCount(0)
  expect(requests).toHaveLength(0)
})

test('authorized lead reads remain available during billing restrictions', async ({ page }) => {
  await mockWorkspace(page, { writesAllowed: false })
  await page.goto('/app/leads')
  await expect(page.getByText('Workspace changes are paused.')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Acme Studio' })).toBeVisible()
})

test('unavailable backend shows an error and retry instead of an empty list', async ({ page }) => {
  let unavailable = true
  await mockWorkspace(page, {
    respond: ({ route, reply }) => unavailable
      ? route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Route not found' } } })
      : reply({ items: [lead], next: null }),
  })
  await page.goto('/app/leads')
  await expect(page.getByRole('alert')).toContainText('Leads are not available for this workspace yet.')
  await expect(page.getByRole('heading', { name: 'No leads yet' })).toHaveCount(0)
  unavailable = false
  await page.getByRole('button', { name: 'Reload latest data' }).click()
  await expect(page.getByRole('cell', { name: 'Acme Studio' })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('loading skeleton resolves to empty and filtered empty states', async ({ page }) => {
  let release
  const pending = new Promise((resolve) => { release = resolve })
  await mockWorkspace(page, {
    respond: async ({ reply }) => {
      await pending
      return reply({ items: [], next: null })
    },
  })
  try {
    await page.goto('/app/leads')
    await expect(page.getByRole('status').filter({ hasText: 'Loading leads…' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'No leads yet' })).toHaveCount(0)
    release()
    await expect(page.getByRole('heading', { name: 'No leads yet' })).toBeVisible()
    await page.getByRole('searchbox', { name: 'Search leads' }).fill('Missing')
    await expect(page.getByRole('heading', { name: 'No matching leads' })).toBeVisible()
    await page.getByRole('region', { name: 'Lead list' }).getByRole('button', { name: 'Clear filters' }).last().click()
    await expect(page.getByRole('heading', { name: 'No leads yet' })).toBeVisible()
  } finally {
    release()
  }
})

for (const mode of ['light', 'dark']) {
  test(`mobile lead list fits the screen in ${mode} mode`, async ({ page }, testInfo) => {
    await mockWorkspace(page)
    await page.addInitScript((theme) => localStorage.setItem('theme', theme), mode)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/app/leads')
    await expect(page.getByRole('cell', { name: 'Acme Studio' })).toBeVisible()
    await expect(page.getByRole('searchbox', { name: 'Search leads' })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Workspace navigation' }).getByRole('link', { name: 'Leads', exact: true })).toHaveAttribute('aria-current', 'page')
    await page.keyboard.press('Escape')
    await page.screenshot({ path: testInfo.outputPath(`leads-mobile-${mode}.png`), fullPage: true })
  })
}
