import { expect, test } from '@playwright/test'
import { mockSignedIn } from './helpers/auth'

const org = '507f1f77bcf86cd799439011'
const id = '507f1f77bcf86cd799439022'
const root = `/api/v1/organizations/${org}`

async function setup(page, grants = [], options = {}) {
  await mockSignedIn(page)
  await page.route('https://fonts.googleapis.com/**', route => route.abort())
  await page.route('https://fonts.gstatic.com/**', route => route.abort())
  const state = { grants, owner: false, writesAllowed: true, name: 'Permitted client', requests: [], ...options }
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    const reply = data => route.fulfill({ json: { data } })
    if (path === '/api/v1/organizations') return reply({ items: [{ id: org, name: 'Permission workspace', status: 'active' }], next: null })
    if (path.endsWith('/permissions')) return reply({ owner: state.owner, role: { name: 'Owner' }, grants: state.grants.map(key => ({ key, scope: key.endsWith('.add') ? 'none' : 'all' })) })
    if (path.endsWith('/access')) return reply({ state: state.writesAllowed ? 'normal' : 'restricted', writesAllowed: state.writesAllowed })
    state.requests.push(path)
    const client = { _id: id, name: state.name, status: state.archived ? 'archived' : 'active', __v: 0 }
    if (path === `${root}/clients`) return reply({ items: [client], next: null })
    if (path === `${root}/clients/${id}`) return reply(client)
    if (path === `${root}/products/${id}`) return reply({ id, name: 'Permitted product', status: 'draft', revision: 0, selectableVariantCount: 1, configuration: { mode: 'single', dimensions: [] } })
    if (path === `${root}/products/${id}/pricing/tables`) return reply({ source: { draft: null, current: { versionId: 'current', intervalRevision: 0 } }, eligibleVariantIds: ['variant'], current: [{ id: 'table', name: 'Standard', variantIds: ['variant'], breaks: [{ from: 1, cost: '10', price: '20' }] }], draft: null, blocker: null })
    if (path.endsWith('/management')) return reply({ clientVersion: 0, relationshipStatus: 'prospect' })
    if (path === `${root}/suppliers/${id}`) return reply({ _id: id, name: 'Permitted supplier', status: state.archived ? 'archived' : 'active', revision: 0, capabilities: ['supplier'] })
    if (path === `${root}/suppliers/${id}/contacts`) return reply({ items: [{ _id: 'contact', name: 'Supplier contact', email: 'contact@example.com', status: state.archivedChild ? 'archived' : 'active', revision: 0 }], next: null })
    return reply({ items: [], next: null })
  })
  return state
}

test('an empty role hides module navigation, overview links and Quick create', async ({ page }) => {
  await setup(page)
  await page.goto('/app')
  const nav = page.getByRole('navigation', { name: 'Workspace navigation' })
  await expect(nav.getByRole('link')).toHaveText(['Overview'])
  await expect(page.getByRole('button', { name: 'Quick create', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Open clients|Open suppliers|Open products/ })).toHaveCount(0)
})

for (const destination of ['clients', `clients/${id}`, `clients/${id}/edit/`, 'suppliers', 'products', 'master-data', 'team', 'roles', 'billing', 'decoration-matrices']) {
  test(`a denied direct URL never mounts or requests ${destination}`, async ({ page }) => {
    const state = await setup(page)
    await page.goto(`/app/${destination}`)
    await expect(page.getByRole('heading', { name: 'Access is limited' })).toBeVisible()
    expect(state.requests).toEqual([])
  })
}

test('organization-linked lead URLs also deny access before requesting the lead', async ({ page }) => {
  const state = await setup(page)
  await page.goto(`/organizations/${org}/inquiries/${id}`)
  await expect(page.getByRole('heading', { name: 'Access is limited' })).toBeVisible()
  expect(state.requests).toEqual([])
})

test('Clients View exposes history but hides create, edit, archive and Contacts', async ({ page }) => {
  const state = await setup(page, ['clients.view'])
  await page.goto(`/app/clients/${id}`)
  await expect(page.getByRole('heading', { name: state.name, exact: true })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Activity', exact: true })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Contacts', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Archive client|Edit relationship/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Edit profile|Edit client/ })).toHaveCount(0)
  expect(state.requests.some(path => path.includes('/contacts'))).toBe(false)
})

for (const action of ['add', 'edit', 'delete']) {
  test(`Clients ${action} exposes only the permitted action`, async ({ page }) => {
    await setup(page, ['clients.view', `clients.${action}`])
    await page.goto('/app/clients')
    await expect(page.getByRole('heading', { name: 'Clients', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create', exact: true })).toHaveCount(action === 'add' ? 1 : 0)
    await page.getByRole('link', { name: 'Permitted client', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Client overview' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit relationship', exact: true })).toHaveCount(action === 'edit' ? 1 : 0)
    await expect(page.getByRole('button', { name: 'Archive client', exact: true })).toHaveCount(action === 'delete' ? 1 : 0)
  })
}

test('restoring a client uses Edit rather than Delete', async ({ page }) => {
  const state = await setup(page, ['clients.view', 'clients.delete'], { archived: true })
  await page.goto(`/app/clients/${id}`)
  await expect(page.getByRole('heading', { name: 'Client overview' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Restore client', exact: true })).toHaveCount(0)
  state.grants = ['clients.view', 'clients.edit']
  await page.evaluate(() => window.dispatchEvent(new Event('workspace-access-changed')))
  await expect(page.getByRole('button', { name: 'Restore client', exact: true })).toBeVisible()
})

for (const action of ['add', 'edit', 'delete']) {
  test(`Supplier ${action} applies independently to the supplier and its children`, async ({ page }) => {
    await setup(page, ['suppliers.view', `suppliers.${action}`])
    await page.goto(`/app/suppliers/${id}`)
    await expect(page.getByRole('heading', { name: 'Permitted supplier', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit details', exact: true })).toHaveCount(action === 'edit' ? 1 : 0)
    await expect(page.getByRole('button', { name: 'Archive supplier', exact: true })).toHaveCount(action === 'delete' ? 1 : 0)
    await page.getByRole('tab', { name: 'Contacts', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Supplier contact', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create', exact: true })).toHaveCount(action === 'add' ? 1 : 0)
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(action === 'edit' ? 1 : 0)
    await expect(page.getByRole('button', { name: 'Archive', exact: true })).toHaveCount(action === 'delete' ? 1 : 0)
  })
}

test('revocation closes open forms and removes cached records; regrant reads fresh data', async ({ page }) => {
  const state = await setup(page, ['clients.view', 'clients.add'])
  await page.goto('/app/clients')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  state.grants = []
  await page.evaluate(() => window.dispatchEvent(new Event('workspace-access-changed')))
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Access is limited' })).toBeVisible()
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Clients', exact: true })).toHaveCount(0)
  state.name = 'Freshly authorized client'
  state.grants = ['clients.view']
  await page.evaluate(() => window.dispatchEvent(new Event('workspace-access-changed')))
  await expect(page.getByRole('link', { name: state.name, exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Permitted client', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Create', exact: true })).toHaveCount(0)
})

test('billing restrictions preserve permitted reads and hide write actions', async ({ page }) => {
  await setup(page, ['clients.view', 'clients.add', 'clients.edit', 'clients.delete'], { writesAllowed: false })
  await page.goto(`/app/clients/${id}`)
  await expect(page.getByRole('heading', { name: 'Client overview' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Archive client|Edit relationship|Quick create/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Edit client|Edit profile/ })).toHaveCount(0)
})

test('owner demotion clears open Product costs even when an obsolete cost grant remains', async ({ page }) => {
  const state = await setup(page, ['products.view', 'products.edit', 'products.pricing.cost'], { owner: true })
  await page.goto(`/app/products/${id}`)
  await page.getByRole('tab', { name: 'Pricing', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Cost, table 1, break 1', exact: true })).toBeVisible()
  state.owner = false
  await page.evaluate(() => window.dispatchEvent(new Event('workspace-access-changed')))
  await expect(page.getByRole('textbox', { name: 'Cost, table 1, break 1', exact: true })).toHaveCount(0)
  await page.getByRole('tab', { name: 'Pricing', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Price, table 1, break 1', exact: true })).toHaveValue('20')
  await expect(page.getByRole('textbox', { name: 'Cost, table 1, break 1', exact: true })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Margin %, table 1, break 1', exact: true })).toHaveCount(0)
})

test('a revoked save removes its dialog and pending error popup without browser errors', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const state = await setup(page, ['clients.view', 'clients.add'])
  await page.route(`**${root}/clients`, route => {
    if (route.request().method() !== 'POST') return route.fallback()
    state.grants = []
    return route.fulfill({ status: 403, json: { error: { code: 'PERMISSION_DENIED', message: 'Client access was removed.' } } })
  })
  await page.goto('/app/clients')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Client name').fill('Blocked client')
  await dialog.getByRole('button', { name: 'Add client', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Access is limited' })).toBeVisible()
  await expect(dialog).toHaveCount(0)
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)))
  expect(errors).toEqual([])
})
