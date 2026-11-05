import { expect, test } from '@playwright/test'
import { mockSignedIn } from './helpers/auth'
import { mockGeography } from './helpers/geography'

const org = '507f1f77bcf86cd799439011'
const supplierId = '507f1f77bcf86cd799439022'
const productId = '507f1f77bcf86cd799439033'
const categoryId = '507f1f77bcf86cd799439044'
const base = `/organizations/${org}`
const supplier = {
  _id: supplierId,
  name: 'Acme Supply',
  supplierCode: 'SUP-000001',
  capabilities: ['supplier'],
  status: 'active',
  revision: 2,
}
const product = {
  id: productId,
  name: 'Cotton polo',
  productCode: 'PRD-000001',
  supplierId,
  supplierItemCode: '001-Ab',
  categoryId: null,
  description: null,
  privateNotes: null,
  status: 'draft',
  revision: 2,
  supplier: { id: supplierId, name: supplier.name, eligible: true },
  category: null,
  readiness: { restoreBlockers: [] },
}

test('superadmin authority does not grant workspace membership or business data', async ({
  page,
}) => {
  const businessReads = []
  await workspace(page, {
    handler: async ({ path, reply }) => {
      if (path === '/admin/me') {
        await reply({ role: 'super_admin' })
        return true
      }
      if (path === '/organizations') {
        await reply({ items: [], next: null })
        return true
      }
      if (path.startsWith('/organizations/')) businessReads.push(path)
      return false
    },
  })
  await page.goto('/app/products')
  await expect(
    page.getByRole('heading', { name: 'Let’s get you settled in' }),
  ).toBeVisible()
  expect(businessReads).toEqual([])
})

test('client profiles save optional fields and use client-specific industry options', async ({
  page,
}) => {
  let saved
  const clientId = '507f1f77bcf86cd799439055'
  await workspace(page, {
    grants: ['clients.view', 'clients.create', 'clients.edit', 'contacts.view'],
    handler: async ({ path, request, reply }) => {
      if (path === `${base}/clients/industry-options`) {
        await reply({
          items: [{ id: categoryId, label: 'Education' }],
          next: null,
        })
        return true
      }
      if (path === `${base}/clients` && request.method() === 'POST') {
        saved = request.postDataJSON()
        await reply({ _id: clientId, ...saved, __v: 0, status: 'active' }, 201)
        return true
      }
      if (path === `${base}/clients/${clientId}`) {
        await reply({ _id: clientId, ...saved, __v: 0, status: 'active' })
        return true
      }
      return false
    },
  })
  await page.goto('/app/clients')
  await page
    .locator('.page-heading')
    .getByRole('button', { name: 'Add client', exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  await dialog
    .getByRole('textbox', { name: 'Client name', exact: true })
    .fill('School Goods')
  await dialog
    .getByLabel('Account label (optional)', { exact: true })
    .fill('West campus')
  await dialog
    .getByLabel('Website (optional)', { exact: true })
    .fill('https://school.example')
  await dialog
    .getByRole('combobox', { name: 'Client industry', exact: true })
    .selectOption(categoryId)
  await dialog
    .getByRole('button', { name: 'Create client', exact: true })
    .click()
  await expect(page).toHaveURL(`/app/clients/${clientId}`)
  expect(saved).toEqual({
    name: 'School Goods',
    accountLabel: 'West campus',
    website: 'https://school.example',
    industryId: categoryId,
  })
})

async function workspace(
  page,
  {
    grants = [
      'products.view',
      'products.create',
      'products.edit',
      'products.archive',
      'products.restore',
      'products.history.view',
      'suppliers.view',
      'suppliers.create',
      'suppliers.edit',
      'suppliers.history.view',
      'master_data.view',
    ],
    owner = true,
    writesAllowed = true,
    handler,
  } = {},
) {
  await mockSignedIn(page)
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace('/api/v1', '')
    const reply = (data, status = 200) =>
      route.fulfill({ status, json: status < 400 ? { data } : { error: data } })
    if (handler && (await handler({ route, request, path, reply }))) return
    if (path === '/admin/me')
      return reply(
        {
          code: 'PLATFORM_ACCESS_REQUIRED',
          message: 'Platform administrator access is required',
        },
        403,
      )
    if (path === '/organizations')
      return reply({
        items: [{ id: org, name: 'Acme Studio', status: 'active' }],
        next: null,
      })
    if (path.endsWith('/permissions'))
      return reply({
        owner,
        grants: grants.map((key) => ({
          key,
          scope: key.endsWith('create') ? 'none' : 'all',
        })),
      })
    if (path.endsWith('/access'))
      return reply({
        writesAllowed,
        state: writesAllowed ? 'normal' : 'restricted',
      })
    if (path.endsWith('/supplier-options'))
      return reply({
        items: [{ id: supplierId, name: supplier.name }],
        next: null,
      })
    if (path.endsWith('/category-options'))
      return reply({
        items: [{ id: categoryId, label: 'Apparel' }],
        next: null,
      })
    if (path === `${base}/products/${productId}`) return reply(product)
    if (path === `${base}/products`)
      return reply({ items: [product], next: null })
    if (path === `${base}/suppliers/${supplierId}`) return reply(supplier)
    if (path.endsWith('/defaults'))
      return reply({
        defaults: {
          revision: 3,
          primaryContactId: null,
          orderingAddressId: null,
          shipFromAddressId: null,
          returnsAddressId: null,
          receivingAddressId: null,
        },
        supplierRevision: 2,
      })
    return reply({ items: [], next: null })
  })
}

test('product creation retries the exact SKU and UUID and opens current detail', async ({
  page,
}) => {
  const writes = []
  await workspace(page, {
    handler: async ({ path, request, reply }) => {
      if (path !== `${base}/products` || request.method() !== 'POST')
        return false
      writes.push({
        body: request.postDataJSON(),
        key: request.headers()['idempotency-key'],
      })
      await reply(
        writes.length === 1
          ? { code: 'UNAVAILABLE', message: 'Retry the same save.' }
          : product,
        writes.length === 1 ? 503 : 201,
      )
      return true
    },
  })
  await page.goto('/app/products')
  await page.getByRole('button', { name: 'Add product', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add product draft' })
  await dialog
    .getByRole('textbox', { name: 'Product name', exact: true })
    .fill('Cotton polo')
  await dialog
    .getByRole('combobox', { name: 'Supplier', exact: true })
    .selectOption(supplierId)
  await dialog
    .getByLabel('Supplier item code (optional)', { exact: true })
    .fill('001-Ab')
  await dialog.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(
    dialog.getByRole('textbox', { name: 'Product name', exact: true }),
  ).toBeDisabled()
  await dialog
    .getByRole('button', { name: 'Retry same request', exact: true })
    .click()
  await expect(page).toHaveURL(`/app/products/${productId}`)
  expect(writes).toHaveLength(2)
  expect(writes[1]).toEqual(writes[0])
  expect(writes[0].body).toEqual({
    name: 'Cotton polo',
    supplierId,
    supplierItemCode: '001-Ab',
    categoryId: null,
    description: null,
    privateNotes: null,
  })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Cotton polo',
  )
  await expect(
    page.getByRole('button', {
      name: /place order|receive stock/i,
    }),
  ).toHaveCount(0)
})

test('billing restricted product readers retain details and history without writes', async ({
  page,
}) => {
  await workspace(page, { owner: false, writesAllowed: false })
  await page.goto(`/app/products/${productId}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Cotton polo',
  )
  await expect(
    page.getByRole('button', {
      name: /edit product|copy product|archive product/i,
    }),
  ).toHaveCount(0)
  await expect(
    page
      .getByRole('complementary', { name: 'Workspace navigation' })
      .getByRole('link', { name: 'Team', exact: true }),
  ).toHaveCount(0)
  await page.getByRole('tab', { name: 'Activity', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'No recorded activity' }),
  ).toBeVisible()
})

test('supplier contacts require email and receiving defaults send canonical geography and revision', async ({
  page,
}) => {
  let body
  await workspace(page, {
    handler: async ({ path, request, reply }) => {
      if (
        path === `${base}/suppliers/${supplierId}/addresses` &&
        request.method() === 'POST'
      ) {
        body = request.postDataJSON()
        await reply(
          {
            address: { _id: categoryId },
            defaults: { revision: 4 },
            supplierRevision: 3,
          },
          201,
        )
        return true
      }
      return false
    },
  })
  await mockGeography(page)
  await page.goto(`/app/suppliers/${supplierId}`)
  await page.getByRole('button', { name: 'Add contact', exact: true }).click()
  await expect(
    page
      .getByRole('dialog')
      .getByRole('textbox', { name: 'Email', exact: true }),
  ).toHaveAttribute('required', '')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Close dialog', exact: true })
    .click()
  await page.getByRole('tab', { name: 'Addresses', exact: true }).click()
  await page.getByRole('button', { name: 'Add address', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Label', { exact: true }).fill('Receiving dock')
  await dialog
    .getByRole('checkbox', { name: 'Ordering', exact: true })
    .uncheck()
  await dialog.getByRole('checkbox', { name: 'Receiving', exact: true }).check()
  await dialog
    .getByRole('combobox', { name: 'Country', exact: true })
    .selectOption('IN')
  await dialog
    .getByRole('combobox', { name: 'State', exact: true })
    .selectOption('IN-RJ')
  await dialog
    .getByRole('checkbox', {
      name: 'Save as default for the selected purposes',
      exact: true,
    })
    .check()
  await dialog.getByRole('button', { name: 'Save record', exact: true }).click()
  await expect.poll(() => body).toBeTruthy()
  expect(body).toMatchObject({
    purposes: ['receiving'],
    address: { country: 'IN', stateCode: 'IN-RJ' },
    setDefaults: { expectedRevision: 3, purposes: ['receiving'] },
  })
  expect(body.address).not.toHaveProperty('region')
})

test('normal members cannot enter administration or edit workspace master data', async ({
  page,
}) => {
  const platformReads = []
  await workspace(page, {
    owner: false,
    grants: ['master_data.view'],
    handler: async ({ path }) => {
      if (path.startsWith('/admin/') && path !== '/admin/me')
        platformReads.push(path)
      return false
    },
  })
  await page.goto('/admin?section=masterData')
  await expect(page.getByRole('alert')).toContainText(
    'Platform administrator access is required',
  )
  expect(platformReads).toEqual([])
  await page.goto('/app/master-data')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Business reference lists',
  )
  await expect(
    page.getByRole('button', { name: 'Add entry', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('tab', { name: 'Activity', exact: true }),
  ).toHaveCount(0)
})

test('superadmin template publication requires a saved-draft comparison and exact consent revision', async ({
  page,
}) => {
  let publication
  const entries = [
    'industry',
    'product_category',
    'decoration_method',
    'decoration_location',
  ].map((category, index) => ({
    category,
    key: `entry_${index}`,
    label: `Label ${index}`,
    description: null,
    status: 'active',
    sortOrder: 0,
  }))
  await workspace(page, {
    handler: async ({ path, request, reply }) => {
      if (path === '/admin/me') {
        await reply({ role: 'super_admin' })
        return true
      }
      if (path === '/admin/master-data/draft') {
        await reply({ revision: 4, version: 1, entries })
        return true
      }
      if (path === '/admin/master-data/versions') {
        await reply({
          items: [{ id: categoryId, version: 1, entries }],
          next: null,
        })
        return true
      }
      if (path === `/admin/master-data/versions/${categoryId}`) {
        await reply({
          version: 1,
          entries: entries.map((entry, index) =>
            index === 0 ? { ...entry, label: 'Old label' } : entry,
          ),
          publication: { evidence: 'unavailable' },
        })
        return true
      }
      if (path === '/admin/master-data/publish') {
        publication = request.postDataJSON()
        await reply({ version: 2 })
        return true
      }
      return false
    },
  })
  await page.goto('/admin?section=masterData')
  await page
    .getByRole('textbox', { name: 'Reason for publishing', exact: true })
    .fill('Reviewed launch defaults')
  await expect(
    page.getByRole('button', { name: 'Publish template', exact: true }),
  ).toBeDisabled()
  await page
    .getByRole('button', { name: 'Review saved draft changes', exact: true })
    .click()
  await expect(page.getByText('Old label', { exact: true })).toBeVisible()
  await page
    .getByRole('button', { name: 'Publish template', exact: true })
    .click()
  await expect
    .poll(() => publication)
    .toEqual({
      expectedRevision: 4,
      expectedVersion: 1,
      reason: 'Reviewed launch defaults',
    })
})

test('product conflicts preserve the draft and require review before using the current revision', async ({
  page,
}) => {
  const writes = []
  let version = 2
  await workspace(page, {
    handler: async ({ path, request, reply }) => {
      if (path !== `${base}/products/${productId}`) return false
      if (request.method() === 'GET') {
        await reply({
          ...product,
          revision: version,
          name: version === 2 ? product.name : 'Colleague name',
        })
        return true
      }
      writes.push(request.postDataJSON())
      if (writes.length === 1) {
        version = 3
        await reply(
          { code: 'VERSION_CONFLICT', message: 'Review the latest revision.' },
          409,
        )
      } else await reply({ ...product, revision: 4, name: 'My reviewed name' })
      return true
    },
  })
  await page.goto(`/app/products/${productId}`)
  await page.getByRole('button', { name: 'Edit product', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog
    .getByRole('textbox', { name: 'Product name', exact: true })
    .fill('My reviewed name')
  await dialog.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(
    dialog.getByRole('cell', { name: 'Colleague name', exact: true }),
  ).toBeVisible()
  await expect(
    dialog.getByRole('textbox', { name: 'Product name', exact: true }),
  ).toHaveValue('My reviewed name')
  await dialog
    .getByRole('button', {
      name: 'Use current revision and keep my edits',
      exact: true,
    })
    .click()
  await dialog.getByRole('button', { name: 'Save draft', exact: true }).click()
  expect(writes.map((write) => write.expectedRevision)).toEqual([2, 3])
  expect(writes[1]).toEqual({ name: 'My reviewed name', expectedRevision: 3 })
})
