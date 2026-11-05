import { expect, test } from '@playwright/test'
import { createHash } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { mockSignedIn } from './helpers/auth'

test.use({ timezoneId: 'Asia/Kolkata' })

test('decoration locations extend saved drafts without changing historical three-category versions', async ({
  page,
}) => {
  const entries = ['industry', 'product_category', 'decoration_method'].map(
    (category, index) => ({
      category,
      key: `entry_${index}`,
      label: `Existing ${index}`,
      description: null,
      sortOrder: 0,
      status: 'active',
    }),
  )
  let draft = {
    revision: 4,
    version: 1,
    entries: [
      ...structuredClone(entries),
      {
        category: 'decoration_method',
        key: 'retired_method',
        label: 'Retired method',
        description: 'Retained for history',
        sortOrder: 1,
        status: 'archived',
      },
    ],
  }
  const writes = []
  await setup(page, {
    handler: async ({ name, request, reply }) => {
      if (name === '/admin/me') {
        await reply({ role: 'super_admin' })
        return true
      }
      if (name === '/admin/master-data/draft') {
        if (request.method() === 'PUT') {
          writes.push(request.postDataJSON())
          draft = {
            ...draft,
            revision: 5,
            entries: request.postDataJSON().entries,
          }
        }
        await reply(draft)
        return true
      }
      if (name === '/admin/master-data/versions') {
        await reply({
          items: [{ id: versionId, version: 1, entries }],
          next: null,
        })
        return true
      }
      if (name === `/admin/master-data/versions/${versionId}`) {
        await reply({
          id: versionId,
          version: 1,
          entries,
          publication: { evidence: 'unavailable' },
        })
        return true
      }
      return false
    },
  })
  await page.goto('/admin?section=masterData')
  await page
    .getByRole('textbox', { name: 'Reason for publishing', exact: true })
    .fill('Add decoration locations')
  await page
    .getByRole('button', { name: 'Review saved draft changes', exact: true })
    .click()
  await expect(
    page.getByText('No active-content changes.', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', {
      name: 'Archived rows retained in the saved draft',
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Publish template', exact: true }),
  ).toBeDisabled()
  await page
    .getByRole('tab', { name: 'Decoration locations', exact: true })
    .click()
  await expect(
    page.getByRole('heading', {
      name: 'No decoration locations yet',
      exact: true,
    }),
  ).toBeVisible()
  await page
    .locator('.section-heading')
    .getByRole('button', { name: 'Add entry', exact: true })
    .click()
  await page
    .getByRole('dialog')
    .getByRole('textbox', { name: 'Name', exact: true })
    .fill('Front chest')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Save to draft', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(writes[0].entries).toEqual(expect.arrayContaining(entries))
  expect(writes[0].entries).toContainEqual({
    category: 'decoration_location',
    key: 'front_chest',
    label: 'Front chest',
    description: null,
    status: 'active',
    sortOrder: 0,
  })
  await expect(
    page.getByRole('button', { name: 'Publish template', exact: true }),
  ).toBeDisabled()
  await page
    .getByRole('button', { name: 'Review saved draft changes', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Publish template', exact: true }),
  ).toBeEnabled()
  await page
    .getByRole('button', { name: 'View publication', exact: true })
    .click()
  await expect(
    page.getByRole('dialog').getByText(/decoration_location/),
  ).toHaveCount(0)
})
const org = '507f1f77bcf86cd799439011',
  productId = '507f1f77bcf86cd799439022',
  supplierId = '507f1f77bcf86cd799439033',
  variantId = '507f1f77bcf86cd799439044',
  scheduleId = '507f1f77bcf86cd799439055',
  versionId = '507f1f77bcf86cd799439066',
  matrixId = '507f1f77bcf86cd799439077',
  methodId = '507f1f77bcf86cd799439088',
  assetId = '507f1f77bcf86cd799439099'
const root = `/organizations/${org}`,
  path = `${root}/products/${productId}`
const product = {
  id: productId,
  name: 'Catalog polo',
  productCode: 'PRD-000001',
  supplierId,
  supplierItemCode: '001-Ab',
  categoryId: null,
  status: 'draft',
  revision: 3,
  configuration: { mode: 'single', dimensions: [], customIdentification: null },
  selectableVariantCount: 1,
  catalogSelectable: false,
  readiness: { activationBlockers: [], restoreBlockers: [] },
  supplier: { id: supplierId, name: 'Supply Co', eligible: true },
}
const variant = {
  id: variantId,
  status: 'selectable',
  selections: [],
  partCode: '001-DEFAULT',
  units: {
    salesUnit: 'each',
    procurementUnit: 'carton',
    salesUnitsPerProcurementUnit: 12,
    procurementMinimum: 2,
    procurementMultiple: 1,
  },
}
const rules = {
  currency: 'USD',
  accountId: 'account',
  warehouseId: 'central',
  agreementId: 'spring',
  tiers: [
    { id: 'tier_1', min: 1, maxExclusive: 101, net: '0.335000', list: null },
  ],
  variants: [{ id: variantId, netPremium: '0', sale: '1.333333' }],
  poolEligible: [],
}
const sources = {
  productRevision: 3,
  configurationVersion: '3',
  scheduleVersion: versionId,
  unitVersion: 'unit-1',
  agreementVersion: versionId,
}

async function setup(
  page,
  {
    owner = true,
    grants = [
      'products.view',
      'products.create',
      'products.edit',
      'products.archive',
      'products.restore',
      'products.history.view',
      'products.pricing.edit',
      'products.pricing.publish',
      'products.pricing.preview',
      'products.pricing.cost',
      'master_data.view',
      'suppliers.view',
    ],
    handler,
  } = {},
) {
  await mockSignedIn(page)
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      name = url.pathname.replace('/api/v1', '')
    const reply = (data, status = 200) =>
      route.fulfill({ status, json: status < 400 ? { data } : { error: data } })
    if (handler && (await handler({ request, url, name, reply }))) return
    if (name === '/organizations')
      return reply({
        items: [{ id: org, name: 'Catalog Studio', status: 'active' }],
        next: null,
      })
    if (name.endsWith('/permissions'))
      return reply({
        owner,
        grants: grants.map((key) => ({ key, scope: 'all' })),
      })
    if (name.endsWith('/access'))
      return reply({ writesAllowed: true, state: 'normal' })
    if (name === path) return reply(product)
    if (name === `${path}/variants`)
      return reply({ items: [variant], next: null })
    if (name === `${path}/pricing/schedules`)
      return reply({ items: [], next: null })
    if (name === `${root}/suppliers`)
      return reply({
        items: [
          {
            _id: supplierId,
            name: 'Decorator Co',
            capabilities: ['decorator'],
            status: 'active',
          },
        ],
        next: null,
      })
    if (name === `${root}/master-data/decoration_method`)
      return reply({
        items: [{ id: methodId, label: 'Screen printing', status: 'active' }],
        next: null,
      })
    return reply({ items: [], next: null })
  })
}

test('explicit single configuration and variant units precede owner activation', async ({
  page,
}) => {
  let current = {
    ...product,
    configuration: {
      mode: 'unresolved',
      dimensions: [],
      customIdentification: null,
    },
    selectableVariantCount: 0,
    readiness: {
      activationBlockers: [
        'CONFIGURATION_REQUIRED',
        'SELECTABLE_VARIANT_REQUIRED',
      ],
      restoreBlockers: [],
    },
  }
  const writes = []
  await setup(page, {
    handler: async ({ name, request, reply }) => {
      if (name === path) {
        await reply(current)
        return true
      }
      if (
        request.method() === 'POST' &&
        [`${path}/configure`, `${path}/variants`, `${path}/activate`].includes(
          name,
        )
      ) {
        const body = request.postDataJSON()
        writes.push({ name, body, key: request.headers()['idempotency-key'] })
        if (name.endsWith('/configure'))
          current = {
            ...current,
            revision: 4,
            configuration: {
              mode: body.mode,
              dimensions: body.dimensions,
              customIdentification: body.customIdentification,
            },
            readiness: { activationBlockers: ['SELECTABLE_VARIANT_REQUIRED'] },
          }
        if (name.endsWith('/variants'))
          current = {
            ...current,
            revision: 5,
            selectableVariantCount: 1,
            readiness: { activationBlockers: [] },
          }
        if (name.endsWith('/activate'))
          current = {
            ...current,
            revision: 6,
            status: 'active',
            catalogSelectable: true,
          }
        await reply(current)
        return true
      }
      return false
    },
  })
  await page.goto(`/app/products/${productId}`)
  await expect(
    page.getByRole('button', { name: 'Activate product', exact: true }),
  ).toBeDisabled()
  await page.getByRole('tab', { name: 'Variants', exact: true }).click()
  await page
    .getByRole('button', { name: 'Edit configuration', exact: true })
    .click()
  await page
    .getByRole('combobox', { name: 'Configuration mode', exact: true })
    .selectOption('single')
  await page
    .getByRole('button', { name: 'Save configuration', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Manage variants', exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  await dialog
    .getByRole('textbox', {
      name: 'Supplier part code (optional)',
      exact: true,
    })
    .fill('001-DEFAULT')
  await dialog
    .getByRole('checkbox', {
      name: 'Specify sales and procurement units',
      exact: true,
    })
    .check()
  await dialog
    .getByRole('textbox', { name: 'Procurement unit', exact: true })
    .fill('carton')
  await dialog
    .getByRole('spinbutton', {
      name: 'Sales units per procurement unit',
      exact: true,
    })
    .fill('12')
  await dialog
    .getByRole('spinbutton', {
      name: 'Procurement minimum (optional)',
      exact: true,
    })
    .fill('2')
  await dialog
    .getByRole('spinbutton', {
      name: 'Procurement multiple (optional)',
      exact: true,
    })
    .fill('1')
  await dialog
    .getByRole('button', { name: 'Save variant changes', exact: true })
    .click()
  await expect(dialog).toHaveCount(0)
  page.once('dialog', (confirmation) => confirmation.accept())
  await page
    .getByRole('button', { name: 'Activate product', exact: true })
    .click()
  await expect.poll(() => current.status).toBe('active')
  expect(writes.map((item) => item.body.expectedRevision)).toEqual([3, 4, 5])
  expect(writes[0].body).toEqual({
    expectedRevision: 3,
    mode: 'single',
    dimensions: [],
    customIdentification: null,
  })
  expect(writes[1].body.changes).toEqual([
    {
      action: 'add',
      selections: [],
      partCode: '001-DEFAULT',
      units: {
        salesUnit: 'each',
        procurementUnit: 'carton',
        salesUnitsPerProcurementUnit: 12,
        procurementMinimum: 2,
        procurementMultiple: 1,
      },
    },
  ])
  expect(writes.every((item) => /^[0-9a-f-]{36}$/.test(item.key))).toBe(true)
})

test('a member with edit authority cannot activate or read owner-only matrix records', async ({
  page,
}) => {
  const forbidden = []
  await setup(page, {
    owner: false,
    handler: async ({ name }) => {
      if (name.includes('/decoration-matrices')) forbidden.push(name)
      return false
    },
  })
  await page.goto(`/app/products/${productId}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Catalog polo',
  )
  await expect(
    page.getByRole('button', { name: 'Activate product', exact: true }),
  ).toHaveCount(0)
  await page.goto(`/app/decoration-matrices/${matrixId}`)
  await expect(
    page.getByRole('heading', { name: 'Access is limited', exact: true }),
  ).toBeVisible()
  expect(forbidden).toEqual([])
})

test('private images retry identical original bytes without reserving or associating twice', async ({
  page,
}) => {
  const bytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6VkoAAAAASUVORK5CYII=',
    'base64',
  )
  const intents = [],
    uploads = [],
    associations = []
  let ready = false,
    selected = false
  await setup(page, {
    handler: async ({ name, request, url, reply }) => {
      if (name === `${path}/media`) {
        await reply({
          revision: 3,
          items: ready
            ? [
                {
                  id: assetId,
                  state: 'ready',
                  version: 1,
                  sha256: 'sanitized-hash',
                },
              ]
            : [],
          effectiveAssetId: selected ? assetId : null,
          source: selected ? 'variant' : null,
        })
        return true
      }
      if (name === `${path}/media/intents`) {
        intents.push(request.postDataJSON())
        await reply({ id: assetId, state: 'pending', version: 1 }, 201)
        return true
      }
      if (name === `${path}/media/${assetId}/content`) {
        uploads.push({
          bytes: request.postDataBuffer(),
          type: request.headers()['content-type'],
        })
        ready = true
        await reply(
          uploads.length === 1
            ? { code: 'MEDIA_BUSY', message: 'Retry the same upload.' }
            : { id: assetId, state: 'ready', version: 1 },
          uploads.length === 1 ? 503 : 200,
        )
        return true
      }
      if (name === `${path}/media/association`) {
        associations.push(request.postDataJSON())
        selected = true
        await reply({ revision: 4, assetId, slot: `variant/${variantId}` })
        return true
      }
      if (name === `${path}/media/${assetId}/access`) {
        await reply({
          url: 'https://storage.googleapis.com/private-test/catalog.webp?signed=short-lived',
          expiresInSeconds: 300,
        })
        return true
      }
      if (url.hostname === 'storage.googleapis.com') return false
      return false
    },
  })
  await page.route('https://storage.googleapis.com/**', (route) =>
    route.fulfill({ body: bytes, contentType: 'image/png' }),
  )
  await page.goto(`/app/products/${productId}`)
  await page.getByRole('tab', { name: 'Images', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Image target', exact: true })
    .selectOption(variantId)
  await page.getByLabel('Choose catalog image').setInputFiles({
    name: 'catalog.png',
    mimeType: 'image/png',
    buffer: bytes,
  })
  await page
    .getByRole('button', { name: 'Upload catalog image', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Retry same image upload', exact: true })
    .click()
  await expect.poll(() => uploads.length).toBe(2)
  expect(intents).toEqual([
    {
      expectedRevision: 3,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      type: 'image/png',
    },
  ])
  expect(uploads[0]).toEqual({ bytes, type: 'image/png' })
  expect(uploads[1]).toEqual(uploads[0])
  expect(associations).toHaveLength(0)
  await page
    .getByRole('button', { name: 'Use for selected target', exact: true })
    .click()
  expect(associations).toEqual([{ expectedRevision: 3, assetId, variantId }])
  await page
    .getByRole('button', { name: 'View private image', exact: true })
    .click()
  await expect(
    page.getByRole('img', {
      name: 'Catalog polo variant catalog image',
      exact: true,
    }),
  ).toBeVisible()
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    'storage.googleapis.com',
  )
  await page
    .getByRole('combobox', { name: 'Image target', exact: true })
    .selectOption('')
  await expect(
    page.getByRole('img', {
      name: 'Catalog polo variant catalog image',
      exact: true,
    }),
  ).toHaveCount(0)
})

test('pricing drafts retain decimal strings and retry keys; publication requires explicit interval review', async ({
  page,
}) => {
  const writes = [],
    publications = []
  let saved = false
  await setup(page, {
    handler: async ({ name, request, reply }) => {
      if (name === `${path}/pricing/schedules` && request.method() === 'POST') {
        writes.push({
          body: request.postDataJSON(),
          key: request.headers()['idempotency-key'],
        })
        saved = writes.length > 1
        await reply(
          saved
            ? { id: scheduleId, revision: 0 }
            : {
                code: 'UNAVAILABLE',
                message: 'Retry this same pricing draft.',
              },
          saved ? 201 : 503,
        )
        return true
      }
      if (name === `${path}/pricing/schedules`) {
        await reply({
          items: saved ? [{ id: scheduleId, revision: 0, ...rules }] : [],
          next: null,
        })
        return true
      }
      if (name === `${path}/pricing/schedules/${scheduleId}`) {
        await reply({ id: scheduleId, revision: 0, rules })
        return true
      }
      if (name === `${path}/pricing/schedules/${scheduleId}/publish`) {
        publications.push(request.postDataJSON())
        await reply({ id: versionId, revision: 1 }, 201)
        return true
      }
      return false
    },
  })
  await page.goto(`/app/products/${productId}`)
  await page.getByRole('tab', { name: 'Pricing', exact: true }).click()
  await page
    .getByRole('button', { name: 'Add pricing schedule', exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  for (const [label, value] of [
    ['Supplier account label', 'account'],
    ['Warehouse label', 'central'],
    ['Agreement label', 'spring'],
    ['Net cost per each', '0.335000'],
  ])
    await dialog.getByRole('textbox', { name: label, exact: true }).fill(value)
  await dialog
    .getByRole('button', { name: 'Add pricing variant', exact: true })
    .click()
  await dialog
    .getByRole('combobox', { name: 'Pricing variant 1', exact: true })
    .selectOption(variantId)
  await dialog
    .getByRole('textbox', { name: 'Sale per each', exact: true })
    .fill('1.333333')
  await dialog
    .getByRole('button', { name: 'Save pricing draft', exact: true })
    .click()
  await dialog
    .getByRole('button', { name: 'Retry same request', exact: true })
    .click()
  await expect(dialog).toHaveCount(0)
  expect(writes).toHaveLength(2)
  expect(writes[1]).toEqual(writes[0])
  expect(writes[0].body).toEqual({ rules })
  await page
    .getByRole('button', { name: 'Publish schedule', exact: true })
    .click()
  const publication = page.getByRole('dialog')
  await expect(
    publication.getByRole('button', {
      name: 'Publish reviewed schedule',
      exact: true,
    }),
  ).toBeDisabled()
  await publication
    .getByLabel('Starts at (blank means server time)', { exact: true })
    .fill('2026-12-01T10:00')
  await publication
    .getByRole('checkbox', {
      name: 'Replace a current published interval',
      exact: true,
    })
    .check()
  await publication
    .getByRole('textbox', { name: 'Replaced version ID', exact: true })
    .fill(versionId)
  await publication
    .getByRole('spinbutton', { name: 'Current interval revision', exact: true })
    .fill('2')
  await publication
    .getByRole('checkbox', { name: /I reviewed this immutable schedule/ })
    .check()
  await publication
    .getByRole('button', { name: 'Publish reviewed schedule', exact: true })
    .click()
  expect(publications).toEqual([
    {
      expectedRevision: 0,
      start: '2026-12-01T04:30:00.000Z',
      end: null,
      replace: { versionId, revision: 2 },
    },
  ])
})

test('sale-only editors never render costs and stale previews require explicit source refresh', async ({
  page,
}) => {
  const sales = [],
    previews = []
  await setup(page, {
    owner: false,
    grants: [
      'products.view',
      'products.pricing.edit',
      'products.pricing.preview',
    ],
    handler: async ({ name, request, reply }) => {
      if (name === `${path}/pricing/schedules`) {
        await reply({
          items: [
            {
              id: scheduleId,
              revision: 5,
              ...rules,
              sales: [{ id: variantId, sale: '1.333333' }],
            },
          ],
          next: null,
        })
        return true
      }
      if (name === `${path}/pricing/schedules/${scheduleId}`) {
        await reply({
          id: scheduleId,
          revision: 5,
          accountId: 'account',
          warehouseId: 'central',
          agreementId: 'spring',
          sales: [{ id: variantId, sale: '1.333333' }],
        })
        return true
      }
      if (name === `${path}/pricing/schedules/${scheduleId}/sales`) {
        sales.push(request.postDataJSON())
        await reply({ id: scheduleId, revision: 6 })
        return true
      }
      if (name === `${path}/pricing/preview`) {
        const body = request.postDataJSON()
        previews.push(body)
        await reply(
          previews.length === 2
            ? { code: 'STALE_SOURCES', message: 'Refresh current sources.' }
            : {
                currency: 'USD',
                sources,
                saleComplete: true,
                goodsSale: '4.00',
                knownSale: '4.00',
                firmTotal: null,
                firmBlockers: ['FREIGHT_UNKNOWN', 'TAX_UNKNOWN'],
                components: [
                  {
                    lineId: 'line_1',
                    variantId,
                    demandEach: 3,
                    sale: '4.00',
                    unknowns: [],
                  },
                ],
              },
          previews.length === 2 ? 409 : 200,
        )
        return true
      }
      return false
    },
  })
  await page.goto(`/app/products/${productId}`)
  await page.getByRole('tab', { name: 'Pricing', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Add pricing schedule', exact: true }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Open editor', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(
    dialog.getByRole('textbox', { name: 'Net cost per each', exact: true }),
  ).toHaveCount(0)
  await dialog
    .getByRole('textbox', { name: `Sale per each · ${variantId}`, exact: true })
    .fill('0')
  await dialog
    .getByRole('button', { name: 'Save pricing draft', exact: true })
    .click()
  await expect(dialog).toHaveCount(0)
  expect(sales).toEqual([
    { expectedRevision: 5, sales: [{ id: variantId, sale: '0' }] },
  ])
  await page.getByRole('tab', { name: 'Goods preview', exact: true }).click()
  for (const [label, value] of [
    ['Supplier account label', 'account'],
    ['Warehouse label', 'central'],
    ['Agreement label', 'spring'],
  ])
    await page.getByRole('textbox', { name: label, exact: true }).fill(value)
  await page
    .getByRole('combobox', { name: 'Demand variant 1', exact: true })
    .selectOption(variantId)
  await page
    .getByRole('spinbutton', { name: 'Demand each 1', exact: true })
    .fill('3')
  await page
    .getByRole('button', { name: 'Preview saved goods prices', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Goods preview · USD', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('columnheader', { name: 'Cost USD', exact: true }),
  ).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Preview saved goods prices', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText('STALE_SOURCES')
  expect(previews[1].expected).toEqual(sources)
  await page
    .getByRole('button', {
      name: 'Refresh preview with current sources',
      exact: true,
    })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Goods preview · USD', exact: true }),
  ).toBeVisible()
  expect(previews[2]).not.toHaveProperty('expected')
})

test('decoration matrices retain unknown rates, publish definitions, and show immutable versions', async ({
  page,
}) => {
  let matrix = {
    id: matrixId,
    revision: 0,
    status: 'active',
    publishedVersion: null,
    content: {
      name: 'Embroidery',
      currency: 'USD',
      supplierId: null,
      methodId: null,
      rules: [],
    },
  }
  const edits = [],
    publications = []
  await setup(page, {
    handler: async ({ name, request, reply }) => {
      if (name === `${root}/decoration-matrices/${matrixId}`) {
        if (request.method() === 'PATCH') {
          edits.push(request.postDataJSON())
          matrix = {
            ...matrix,
            revision: 1,
            content: request.postDataJSON().content,
          }
          await reply({ id: matrixId, revision: 1 })
        } else await reply(matrix)
        return true
      }
      if (name === `${root}/decoration-matrices/${matrixId}/publish`) {
        publications.push(request.postDataJSON())
        matrix = { ...matrix, revision: 2, publishedVersion: versionId }
        await reply({ id: matrixId, revision: 2 })
        return true
      }
      if (name.endsWith('/versions')) {
        await reply({
          items: [
            { id: versionId, revision: 1, publishedAt: '2026-11-04T00:00:00Z' },
          ],
          next: null,
        })
        return true
      }
      if (name.endsWith(`/versions/${versionId}`)) {
        await reply({
          id: versionId,
          matrixId,
          revision: 1,
          content: matrix.content,
          supplier: { name: 'Decorator Co' },
          method: { label: 'Screen printing' },
        })
        return true
      }
      return false
    },
  })
  await page.goto(`/app/decoration-matrices/${matrixId}`)
  await expect(
    page.getByRole('button', { name: 'Publish matrix', exact: true }),
  ).toBeDisabled()
  await page
    .getByRole('button', { name: 'Edit matrix draft', exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  await dialog
    .getByRole('combobox', { name: 'Supplier or decorator', exact: true })
    .selectOption(supplierId)
  await dialog
    .getByRole('combobox', { name: 'Decoration method', exact: true })
    .selectOption(methodId)
  await dialog
    .getByRole('button', { name: 'Add matrix rule', exact: true })
    .click()
  await dialog
    .getByRole('combobox', { name: 'Quantity basis', exact: true })
    .selectOption('good')
  await dialog
    .getByRole('button', { name: 'Add matrix cell', exact: true })
    .click()
  await dialog
    .getByRole('textbox', { name: 'Cell cost USD', exact: true })
    .fill('0.250000')
  await dialog
    .getByRole('button', { name: 'Save matrix draft', exact: true })
    .click()
  await expect(dialog).toHaveCount(0)
  expect(edits[0].content.rules[0]).toMatchObject({
    id: 'rule_1',
    type: 'color',
    quantityBasis: 'good',
    chargeUnit: 'decorated_item',
    cells: [
      {
        id: 'cell_1',
        quantity: { min: 1, maxExclusive: 101 },
        parameter: { min: 1, maxExclusive: 2 },
        available: true,
        cost: '0.250000',
        sale: null,
      },
    ],
  })
  await page
    .getByRole('button', { name: 'Publish matrix', exact: true })
    .click()
  await page
    .getByRole('checkbox', {
      name: 'I reviewed this publish action.',
      exact: true,
    })
    .check()
  await page
    .getByRole('button', { name: 'Confirm publish', exact: true })
    .click()
  expect(publications).toEqual([{ expectedRevision: 1 }])
  await page.getByRole('tab', { name: 'Versions', exact: true }).click()
  await page
    .getByRole('button', { name: 'View immutable version', exact: true })
    .click()
  await expect(
    page.getByRole('dialog').getByText('1–100', { exact: true }),
  ).toBeVisible()
  await expect(
    page
      .getByRole('dialog')
      .getByRole('cell', { name: 'Unknown', exact: true }),
  ).toBeVisible()
})

test('overlapping decoration rectangles preserve the draft and block a save', async ({
  page,
}) => {
  let writes = 0
  await setup(page, {
    handler: async ({ name, request, reply }) => {
      if (
        name === `${root}/decoration-matrices` &&
        request.method() === 'POST'
      ) {
        writes++
        await reply({ id: matrixId, revision: 0 }, 201)
        return true
      }
      return false
    },
  })
  await page.goto('/app/decoration-matrices')
  await page
    .getByRole('button', { name: 'Add decoration matrix', exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  await dialog
    .getByRole('textbox', { name: 'Matrix name', exact: true })
    .fill('Preserved matrix')
  await dialog
    .getByRole('button', { name: 'Add matrix rule', exact: true })
    .click()
  await dialog
    .getByRole('button', { name: 'Add matrix cell', exact: true })
    .click()
  await dialog
    .getByRole('button', { name: 'Add matrix cell', exact: true })
    .click()
  await dialog
    .getByRole('button', { name: 'Save matrix draft', exact: true })
    .click()
  await expect(
    dialog.getByText('Overlapping cells:', { exact: false }),
  ).toBeVisible()
  await expect(
    dialog.getByRole('textbox', { name: 'Matrix name', exact: true }),
  ).toHaveValue('Preserved matrix')
  expect(writes).toBe(0)
  page.once('dialog', (confirmation) => confirmation.accept())
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
})
