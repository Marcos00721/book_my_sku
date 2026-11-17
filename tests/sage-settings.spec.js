import { expect, test } from '@playwright/test'
import { mockSignedIn } from './helpers/auth'

const initial = { status: 'disconnected', revision: 0, version: 0, accountHint: null, testedAt: null }

async function mockWorkspace(page, { owner = true, writesAllowed = true, metadata = initial, connectionError, post } = {}) {
  await mockSignedIn(page)
  const requests = []
  let current = { ...metadata }
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    let data = { items: [], next: null }
    if (path === '/api/v1/organizations') data = { items: [{ id: 'studio', name: 'Acme Studio', status: 'active' }], next: null }
    else if (path.endsWith('/permissions')) data = { owner, grants: [] }
    else if (path.endsWith('/access')) data = { writesAllowed, state: writesAllowed ? 'normal' : 'restricted' }
    else if (path.includes('/sage/')) {
      requests.push({ path, method: request.method(), body: request.method() === 'POST' ? request.postDataJSON() : null, key: request.headers()['idempotency-key'] })
      if (connectionError) return route.fulfill({ status: connectionError.status || 503, json: { error: connectionError } })
      if (request.method() === 'POST') {
        if (post && await post(route, requests)) return
        if (path.endsWith('/configure')) current = { status: 'connected', revision: current.revision + 1, version: current.version + 1, accountHint: '**45', testedAt: null }
        else if (path.endsWith('/test')) current = { ...current, testedAt: '2026-11-17T09:00:00Z' }
        else if (path.endsWith('/disconnect')) current = { ...initial, revision: current.revision + 1, version: current.version + 1 }
      }
      data = current
    }
    return route.fulfill({ json: { data } })
  })
  return requests
}

async function enterCredentials(page) {
  await page.getByLabel('SAGE account ID', { exact: true }).fill('12345')
  await page.getByLabel('SAGE login ID', { exact: true }).fill('catalog-user')
  await page.getByLabel('SAGE account key', { exact: true }).fill('fixture-sage-key')
}

test('owner opens Settings and configures, tests and disconnects SAGE using current revisions', async ({ page }) => {
  const requests = await mockWorkspace(page)
  await page.goto('/app')
  await page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('link', { name: 'Settings', exact: true }).click()
  await expect(page).toHaveURL(/\/app\/settings$/)
  await expect(page.getByRole('tab', { name: 'Integrations' })).toHaveAttribute('aria-selected', 'true')
  await enterCredentials(page)
  await expect(page.getByLabel('SAGE account key', { exact: true })).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Save connection', exact: true }).click()
  await expect(page.getByText('SAGE credentials saved.', { exact: false })).toBeVisible()
  await expect(page.getByText('Configured', { exact: true })).toBeVisible()
  await expect(page.getByText('**45', { exact: true })).toBeVisible()
  await expect(page.getByLabel('SAGE account key', { exact: true })).toHaveValue('')
  await page.getByRole('button', { name: 'Test connection', exact: true }).click()
  await expect(page.getByText('SAGE connectivity test passed.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Disconnect SAGE', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Disconnect', exact: true }).click()
  await expect(page.getByText('Disconnected', { exact: true })).toBeVisible()
  const writes = requests.filter((request) => request.method === 'POST')
  expect(writes.map((request) => request.body)).toEqual([
    { expectedRevision: 0, acctId: 12345, loginId: 'catalog-user', key: 'fixture-sage-key' },
    { expectedRevision: 1 }, { expectedRevision: 1 },
  ])
  for (const request of writes) expect(request.key).toMatch(/^[0-9a-f-]{36}$/)
  expect(new Set(writes.map((request) => request.key)).size).toBe(3)
  const storage = await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]))
  expect(storage).not.toContain('fixture-sage-key')
  expect(storage).not.toContain('catalog-user')
  expect(requests.every((request) => request.path.startsWith('/api/v1/organizations/studio/sage/'))).toBe(true)
})

test('uncertain configure retry retains the original body and UUID and prevents other actions', async ({ page }) => {
  let attempts = 0
  const requests = await mockWorkspace(page, { post: async (route) => {
    attempts++
    if (attempts === 1) { await route.abort('connectionfailed'); return true }
    return false
  } })
  await page.goto('/app/settings/integrations')
  await enterCredentials(page)
  await page.getByRole('button', { name: 'Save connection', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Retry original request' })).toBeVisible()
  await expect(page.getByLabel('SAGE account key', { exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Save connection', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Retry original request' }).click()
  await expect(page.getByText('Configured', { exact: true })).toBeVisible()
  const writes = requests.filter((request) => request.method === 'POST')
  expect(writes).toHaveLength(2)
  expect(writes[1]).toEqual(writes[0])
  await expect(page.getByLabel('SAGE account key', { exact: true })).toHaveValue('')
})

test('revision conflicts retain input and require a refresh before another save', async ({ page }) => {
  const requests = await mockWorkspace(page, { post: async (route) => {
    await route.fulfill({ status: 409, json: { error: { code: 'VERSION_CONFLICT', message: 'Connection changed. Refresh and review.' } } })
    return true
  } })
  await page.goto('/app/settings')
  await enterCredentials(page)
  await page.getByRole('button', { name: 'Save connection', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Connection changed')
  await expect(page.getByLabel('SAGE account key', { exact: true })).toHaveValue('fixture-sage-key')
  await expect(page.getByRole('button', { name: 'Save connection', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Refresh connection' }).click()
  await expect(page.getByRole('button', { name: 'Save connection', exact: true })).toBeEnabled()
  expect(requests.filter((request) => request.method === 'POST')).toHaveLength(1)
})

test('members cannot discover Settings or call its connection API through the direct route', async ({ page }) => {
  const requests = await mockWorkspace(page, { owner: false })
  await page.goto('/app/settings')
  await expect(page.getByRole('heading', { name: 'Access is limited' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Settings', exact: true })).toHaveCount(0)
  expect(requests).toHaveLength(0)
})

test('billing restrictions prevent SAGE reads and writes', async ({ page }) => {
  const requests = await mockWorkspace(page, { writesAllowed: false })
  await page.goto('/app/settings')
  await expect(page.getByText('SAGE settings are paused', { exact: false })).toBeVisible()
  await expect(page.getByLabel('SAGE account key', { exact: true })).toHaveCount(0)
  expect(requests).toHaveLength(0)
})

for (const code of ['SAGE_DISABLED', 'SAGE_SCHEMA_REQUIRED']) {
  test(`${code} shows the backend availability without offering a credential form`, async ({ page }) => {
    await mockWorkspace(page, { connectionError: { code, message: 'Refresh SAGE connection or preview and review the request' } })
    await page.goto('/app/settings')
    await expect(page.getByRole('status')).toContainText(code === 'SAGE_DISABLED' ? 'not enabled' : 'backend update')
    await expect(page.getByLabel('SAGE account key', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Refresh connection' })).toBeEnabled()
  })
}

test('replacement requires confirmation and blank optional login is omitted', async ({ page }) => {
  const requests = await mockWorkspace(page, { metadata: { ...initial, status: 'connected', revision: 4, version: 2, accountHint: '**45' } })
  await page.goto('/app/settings')
  await enterCredentials(page)
  await page.getByLabel('SAGE login ID', { exact: true }).fill('')
  await page.getByRole('button', { name: 'Replace connection', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(requests.filter((request) => request.method === 'POST')).toHaveLength(0)
  await page.getByRole('button', { name: 'Replace connection', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Replace connection', exact: true }).click()
  await expect(page.getByLabel('SAGE account key', { exact: true })).toHaveValue('')
  expect(requests.find((request) => request.method === 'POST').body).toEqual({ expectedRevision: 4, acctId: 12345, key: 'fixture-sage-key' })
})

for (const mode of ['light', 'dark']) {
  test(`SAGE settings fit desktop and mobile in ${mode} mode`, async ({ page }, testInfo) => {
    await mockWorkspace(page)
    await page.addInitScript((theme) => localStorage.setItem('theme', theme), mode)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/app/settings')
    await expect(page.getByLabel('SAGE account key', { exact: true })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`sage-desktop-${mode}.png`), fullPage: true })
    await page.setViewportSize({ width: 375, height: 812 })
    await expect(page.getByLabel('SAGE account key', { exact: true })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
    await page.screenshot({ path: testInfo.outputPath(`sage-mobile-${mode}.png`), fullPage: true })
  })
}
