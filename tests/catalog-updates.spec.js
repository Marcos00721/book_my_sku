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
    .getByRole('button', { name: 'Create', exact: true })
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

test('active variant corrections preserve the variant and retry the exact correction', async ({
  page,
}) => {
  const writes = []
  await setup(page, {
    handler: async ({ name, request, reply }) => {
      if (name === path) {
        await reply({ ...product, status: 'active' })
        return true
      }
      if (name === `${path}/variants` && request.method() === 'POST') {
        writes.push({
          body: request.postDataJSON(),
          key: request.headers()['idempotency-key'],
        })
        await reply(
          writes.length === 1
            ? { code: 'UNAVAILABLE', message: 'Please retry.' }
            : { ...product, revision: 4 },
          writes.length === 1 ? 503 : 200,
        )
        return true
      }
      return false
    },
  })
  await page.goto(`/app/products/${productId}`)
  await page.getByRole('tab', { name: 'Variants', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Manage variants', exact: true }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: /Correct details for/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog
    .getByRole('textbox', { name: 'Supplier part code', exact: true })
    .fill('SKU-FIXED')
  await dialog
    .getByRole('textbox', { name: 'Purchase unit', exact: true })
    .fill('box')
  await dialog
    .getByRole('spinbutton', { name: 'Items per purchase unit', exact: true })
    .fill('24')
  await expect(dialog.getByRole('status')).toContainText(
    '1 box = 24 individual items',
  )
  await dialog
    .getByRole('textbox', { name: 'Reason for correction', exact: true })
    .fill('Supplier confirmed the box size')
  await expect(
    dialog.getByRole('button', { name: 'Save correction', exact: true }),
  ).toBeDisabled()
  await dialog
    .getByRole('checkbox', { name: /This is the same physical item/ })
    .check()
  await dialog
    .getByRole('button', { name: 'Save correction', exact: true })
    .click()
  await expect(
    dialog.getByRole('textbox', { name: 'Supplier part code', exact: true }),
  ).toBeDisabled()
  await dialog
    .getByRole('button', { name: 'Retry same request', exact: true })
    .click()
  await expect(dialog).toHaveCount(0)
  expect(writes).toHaveLength(2)
  expect(writes[1]).toEqual(writes[0])
  expect(writes[0].body).toEqual({
    expectedRevision: 3,
    changes: [
      {
        action: 'correct',
        variantId,
        samePhysicalVariant: true,
        reason: 'Supplier confirmed the box size',
        partCode: 'SKU-FIXED',
        units: {
          baseUnit: 'item',
          salesUnit: 'each',
          procurementUnit: 'box',
          salesUnitsPerProcurementUnit: 24,
          procurementMinimum: 2,
          procurementMultiple: 1,
        },
      },
    ],
  })
})

test('colors and sizes add multiple values and reject duplicate names', async ({
  page,
}) => {
  let configured
  await setup(page, {
    handler: async ({ name, request, reply }) => {
      if (name === path) {
        await reply({
          ...product,
          selectableVariantCount: 0,
          configuration: { mode: 'unresolved', dimensions: [] },
        })
        return true
      }
      if (name.endsWith('/configure') && request.method() === 'POST') {
        configured = request.postDataJSON()
        await reply(product)
        return true
      }
      return false
    },
  })
  await page.goto(`/app/products/${productId}`)
  await page.getByRole('tab', { name: 'Variants', exact: true }).click()
  await page
    .getByRole('button', { name: 'Add colors & sizes', exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('textbox')).toHaveCount(2)
  const color = dialog.getByRole('textbox', { name: 'Color', exact: true })
  const size = dialog.getByRole('textbox', { name: 'Size', exact: true })
  await color.fill('Navy Blue')
  await dialog.getByRole('button', { name: 'Add color', exact: true }).click()
  await color.fill(' navy BLUE ')
  await dialog.getByRole('button', { name: 'Add color', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('already added')
  expect(configured).toBeUndefined()
  await color.fill('White')
  await color.press('Enter')
  await size.fill('M')
  await dialog.getByRole('button', { name: 'Add size', exact: true }).click()
  await size.fill('L') // Saving includes a value even without clicking Add.
  await expect(dialog.getByRole('textbox', { name: /key/i })).toHaveCount(0)
  await dialog
    .getByRole('button', { name: 'Save colors & sizes', exact: true })
    .click()
  await expect(dialog).toHaveCount(0)
  expect(configured.dimensions).toEqual([
    {
      id: 'color',
      label: 'Color',
      values: [
        { id: 'navy_blue', label: 'Navy Blue' },
        { id: 'white', label: 'White' },
      ],
    },
    {
      id: 'size',
      label: 'Size',
      values: [{ id: 'm', label: 'M' }, { id: 'l', label: 'L' }],
    },
  ])
})

test('editing colors preserves existing IDs and retries the same configuration', async ({ page }) => {
  const writes = []
  const configuration = {
    mode: 'variants',
    dimensions: [
      {
        id: 'supplier_color', label: 'Colour',
        values: [{ id: 'c001', label: 'Navy' }, { id: 'c002', label: 'White' }],
      },
      { id: 'supplier_size', label: 'Size', values: [{ id: 's001', label: 'M' }] },
    ],
    customIdentification: 'Reviewed supplier sample',
  }
  await setup(page, {
    handler: async ({ name, request, reply }) => {
      if (name === path) {
        await reply({ ...product, configuration })
        return true
      }
      if (name === `${path}/configure` && request.method() === 'POST') {
        writes.push({ body: request.postDataJSON(), key: request.headers()['idempotency-key'] })
        await reply(writes.length === 1 ? { code: 'UNAVAILABLE', message: 'Please retry.' } : product, writes.length === 1 ? 503 : 200)
        return true
      }
      return false
    },
  })
  await page.goto(`/app/products/${productId}`)
  await page.getByRole('tab', { name: 'Variants', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Saved colour options' })).toContainText('Navy')
  await page.getByRole('button', { name: 'Edit colors & sizes', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Remove color Navy', exact: true }).click()
  await dialog.getByRole('textbox', { name: 'Color', exact: true }).fill('Navy')
  await dialog.getByRole('button', { name: 'Add color', exact: true }).click()
  await dialog.getByRole('button', { name: 'Remove color White', exact: true }).click()
  await dialog.getByRole('textbox', { name: 'Color', exact: true }).fill('Red')
  await dialog.getByRole('button', { name: 'Save colors & sizes', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Retry same request', exact: true })).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: 'Color', exact: true })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Retry same request', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(writes).toHaveLength(2)
  expect(writes[0]).toEqual(writes[1])
  expect(writes[0].key).toBeTruthy()
  expect(writes[0].body).toEqual({
    expectedRevision: 3,
    mode: 'variants',
    dimensions: [
      { id: 'supplier_color', label: 'Colour', values: [{ id: 'c001', label: 'Navy' }, { id: 'red', label: 'Red' }] },
      configuration.dimensions[1],
    ],
    customIdentification: 'Reviewed supplier sample',
  })
})

for (const width of [375, 1440]) {
  test(`color and size choices save only the selected combinations at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 })
    const writes = []
    let current = {
      ...product,
      selectableVariantCount: 0,
      configuration: {
        mode: 'unresolved', dimensions: [], customIdentification: null,
      },
    }
    await setup(page, {
      handler: async ({ name, request, reply }) => {
        if (name === path) {
          await reply(current)
          return true
        }
        if (request.method() === 'POST' && [`${path}/configure`, `${path}/variants`].includes(name)) {
          const body = request.postDataJSON()
          writes.push({ name, body })
          if (name.endsWith('/configure')) current = { ...current, revision: 4, configuration: body }
          else current = { ...current, revision: 5, selectableVariantCount: 2 }
          await reply(current)
          return true
        }
        if (name === `${path}/variants`) {
          await reply({ items: [], next: null })
          return true
        }
        return false
      },
    })
    await page.goto(`/app/products/${productId}`)
    await page.getByRole('tab', { name: 'Variants', exact: true }).click()
    await page.getByRole('button', { name: 'Add colors & sizes', exact: true }).click()
    let dialog = page.getByRole('dialog')
    for (const [name, values] of [['Color', ['Red', 'Blue']], ['Size', ['M', 'L']]]) {
      for (const value of values) {
        await dialog.getByRole('textbox', { name, exact: true }).fill(value)
        await dialog.getByRole('button', { name: `Add ${name.toLowerCase()}`, exact: true }).click()
      }
    }
    await expect(dialog).toBeInViewport()
    expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
    await page.screenshot({ path: test.info().outputPath('colors-sizes.png') })
    await dialog.getByRole('button', { name: 'Save colors & sizes', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await page.getByRole('button', { name: 'Add variants', exact: true }).click()
    dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('textbox', { name: 'Supplier part code (optional)', exact: true })).toBeHidden()
    for (const [index, color, size] of [[0, 'Red', 'M'], [1, 'Blue', 'L']]) {
      if (index) await dialog.getByRole('button', { name: 'Add variant', exact: true }).click()
      for (const [label, option] of [['Color', color], ['Size', size]]) {
        await dialog.getByRole('button', { name: label, exact: true }).nth(index).click()
        await dialog.getByRole('option', { name: option, exact: true }).click()
      }
    }
    await dialog.getByRole('button', { name: 'Save variants', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    expect(writes.map((write) => write.name)).toEqual([`${path}/configure`, `${path}/variants`])
    expect(writes[1].body).toEqual({
      expectedRevision: 4,
      changes: [
        { action: 'add', selections: [{ dimensionId: 'color', valueId: 'red' }, { dimensionId: 'size', valueId: 'm' }] },
        { action: 'add', selections: [{ dimensionId: 'color', valueId: 'blue' }, { dimensionId: 'size', valueId: 'l' }] },
      ],
    })
  })
}

test('other existing options keep their editor and active products cannot change colors', async ({ page }) => {
  const configuration = { mode: 'variants', dimensions: [{ id: 'material', label: 'Material', values: [{ id: 'cotton', label: 'Cotton' }] }] }
  await setup(page, {
    handler: async ({ name, reply }) => {
      if (name === path) {
        await reply({ ...product, configuration })
        return true
      }
      return false
    },
  })
  await page.goto(`/app/products/${productId}`)
  await page.getByRole('tab', { name: 'Variants', exact: true }).click()
  await page.getByRole('button', { name: 'Edit options', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Option 1 name', exact: true })).toHaveValue('Material')
  await page.route(`**/api/v1${path}`, (route) => route.fulfill({ json: { data: {
    ...product, status: 'active', configuration: {
      mode: 'variants', dimensions: [{ id: 'color', label: 'Color', values: [{ id: 'red', label: 'Red' }] }],
    },
  } } }))
  await page.reload()
  await page.getByRole('tab', { name: 'Variants', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Saved color options' })).toContainText('Red')
  await expect(page.getByRole('button', { name: /Edit colors|Add colors|Manage variants|Add variants/ })).toHaveCount(0)
})

test('purchase-unit costs survive editing with inclusive quantity limits and exact decimals', async ({
  page,
}) => {
  const savedRules = {
    ...structuredClone(rules),
    tiers: [
      {
        id: 'supplier_box',
        min: 1,
        maxExclusive: 101,
        netBasis: 'procurement_unit',
        net: '24.123456',
        list: null,
      },
    ],
  }
  const writes = []
  await setup(page, {
    handler: async ({ name, request, reply }) => {
      if (name === `${path}/pricing/schedules`) {
        await reply({
          items: [{ id: scheduleId, revision: 2, ...savedRules }],
          next: null,
        })
        return true
      }
      if (name === `${path}/pricing/schedules/${scheduleId}`) {
        if (request.method() === 'PATCH') {
          writes.push(request.postDataJSON())
          await reply({ id: scheduleId, revision: 3 })
        } else await reply({ id: scheduleId, revision: 2, rules: savedRules })
        return true
      }
      return false
    },
  })
  await page.goto(`/app/products/${productId}`)
  await page.getByRole('tab', { name: 'Pricing', exact: true }).click()
  await page.getByRole('button', { name: 'Open editor', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(
    dialog.getByRole('spinbutton', { name: 'Through quantity', exact: true }),
  ).toHaveValue('100')
  await expect(
    dialog.getByRole('textbox', {
      name: 'Supplier cost per purchase unit (USD)',
      exact: true,
    }),
  ).toHaveValue('24.123456')
  await dialog
    .getByRole('spinbutton', { name: 'Through quantity', exact: true })
    .fill('250')
  await dialog
    .getByRole('textbox', { name: 'Selling price per item (USD)', exact: true })
    .fill('0')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(dialog).toBeVisible()
  expect(
    await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true)
  await page.screenshot({
    path: 'test-results/custom-products-pricing-mobile.png',
  })
  await dialog
    .getByRole('button', { name: 'Save pricing draft', exact: true })
    .click()
  await expect(dialog).toHaveCount(0)
  expect(writes[0]).toEqual({
    expectedRevision: 2,
    rules: {
      ...savedRules,
      tiers: [{ ...savedRules.tiers[0], maxExclusive: 251 }],
      variants: [{ id: variantId, netPremium: '0', sale: '0' }],
    },
  })
})

test('pricing correction review shows packaging changes and retries partial failures with the same target keys', async ({
  page,
}) => {
  const secondVersion = '507f1f77bcf86cd799439067'
  const applied = []
  const reviews = []
  const before = [
    {
      id: variantId,
      procurementUnit: 'box',
      eachPerProcurementUnit: 12,
      minimum: 1,
      multiple: 1,
    },
  ]
  const after = [{ ...before[0], eachPerProcurementUnit: 24 }]
  await setup(page, {
    handler: async ({ name, request, reply }) => {
      if (name === `${path}/pricing/schedules`) {
        await reply({
          items: [versionId, secondVersion].map((id) => ({
            id,
            revision: 0,
            ...rules,
            start: '2026-11-01T00:00:00.000Z',
          })),
          next: null,
        })
        return true
      }
      if (name.endsWith('/adoption-preview')) {
        reviews.push(request.postDataJSON())
        await reply({
          productRevision: 4,
          items: reviews.at(-1).versions.map((id) => ({
            versionId: id,
            before,
            after,
            blockers: [],
          })),
        })
        return true
      }
      if (name.endsWith('/adoptions')) {
        applied.push(request.postDataJSON())
        await reply({
          items: [
            {
              versionId,
              status: 'applied',
              draft: { id: scheduleId, revision: 0 },
            },
            applied.length === 1
              ? {
                  versionId: secondVersion,
                  status: 'failed',
                  code: 'ADOPTION_FAILED',
                }
              : {
                  versionId: secondVersion,
                  status: 'applied',
                  draft: { id: secondVersion, revision: 0 },
                },
          ],
        })
        return true
      }
      return false
    },
  })
  await page.goto(`/app/products/${productId}`)
  await page.getByRole('tab', { name: 'Pricing', exact: true }).click()
  await page
    .getByRole('button', { name: 'Pricing schedule view', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'Published versions', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Review packaging corrections', exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  for (const checkbox of await dialog.getByRole('checkbox').all())
    await checkbox.check()
  await dialog
    .getByRole('button', { name: 'Review packaging changes', exact: true })
    .click()
  await expect(
    dialog.getByRole('cell', { name: /1 box = 12 items/ }),
  ).toHaveCount(2)
  await expect(
    dialog.getByRole('cell', { name: /1 box = 24 items/ }),
  ).toHaveCount(2)
  await expect(
    dialog.getByRole('button', {
      name: 'Create 2 updated drafts',
      exact: true,
    }),
  ).toBeDisabled()
  await dialog
    .getByRole('checkbox', { name: /I reviewed the packaging/ })
    .check()
  await dialog
    .getByRole('button', { name: 'Create 2 updated drafts', exact: true })
    .click()
  await expect(dialog.getByText(/Could not confirm/)).toBeVisible()
  await dialog
    .getByRole('button', { name: 'Retry same request', exact: true })
    .click()
  await expect(dialog.getByText(/Draft created/)).toHaveCount(2)
  expect(applied).toHaveLength(2)
  expect(applied[1]).toEqual(applied[0])
  expect(applied[0].expectedProductRevision).toBe(4)
  expect(
    new Set(applied[0].targets.map((target) => target.operationKey)).size,
  ).toBe(2)
  expect(
    applied[0].targets.every((target) =>
      /^[0-9a-f-]{36}$/.test(target.operationKey),
    ),
  ).toBe(true)
})

test('historical preview sends the retained version and uses saved variant choices', async ({
  page,
}) => {
  const previews = []
  await setup(page, {
    handler: async ({ name, request, reply }) => {
      const published = {
        id: versionId,
        revision: 1,
        ...rules,
        rules,
        start: '2026-10-01T00:00:00.000Z',
        end: '2026-11-01T00:00:00.000Z',
      }
      if (name === `${path}/pricing/schedules`) {
        await reply({ items: [published], next: null })
        return true
      }
      if (name === `${path}/pricing/schedules/${versionId}`) {
        await reply(published)
        return true
      }
      if (name.endsWith('/pricing/preview')) {
        previews.push(request.postDataJSON())
        await reply({
          currency: 'USD',
          goodsSale: '4.00',
          knownSale: '4.00',
          saleComplete: true,
          costComplete: true,
          goodsCost: '2.00',
          sources,
          components: [],
        })
        return true
      }
      return false
    },
  })
  await page.goto(`/app/products/${productId}`)
  await page.getByRole('tab', { name: 'Pricing', exact: true }).click()
  await page
    .getByRole('button', { name: 'Pricing schedule view', exact: true })
    .click()
  await page
    .getByRole('option', { name: 'Published versions', exact: true })
    .click()
  await page.getByRole('button', { name: 'View details', exact: true }).click()
  await page
    .getByRole('button', { name: 'Preview saved version', exact: true })
    .click()
  await expect(page.getByText(/Historical preview:/)).toBeVisible()
  await page
    .getByRole('spinbutton', { name: 'Quantity in items 1', exact: true })
    .fill('3')
  await page
    .getByRole('button', { name: 'Calculate preview', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Goods preview · USD', exact: true }),
  ).toBeVisible()
  expect(previews[0]).toMatchObject({
    versionId,
    accountId: 'account',
    warehouseId: 'central',
    agreementId: 'spring',
    lines: [{ id: 'line_1', variantId, demandEach: 3, pool: false }],
  })
})

test('current price preview fills saved labels and offers only covered variants', async ({
  page,
}) => {
  const previews = []
  const otherVariantId = '507f1f77bcf86cd799439045'
  await setup(page, {
    handler: async ({ name, request, reply }) => {
      if (name === `${path}/pricing/schedules`) {
        await reply({
          items: [
            {
              id: versionId,
              ...rules,
              rules,
              start: '2026-11-01T00:00:00.000Z',
            },
          ],
          next: null,
        })
        return true
      }
      if (name === `${path}/variants`) {
        await reply({
          items: [
            variant,
            { ...variant, id: otherVariantId, partCode: 'NOT-IN-PRICE-LIST' },
          ],
          next: null,
        })
        return true
      }
      if (name.endsWith('/pricing/preview')) {
        previews.push(request.postDataJSON())
        await reply({
          currency: 'USD',
          saleComplete: false,
          knownSale: '0.00',
          goodsSale: null,
          sources,
          components: [
            {
              lineId: 'line_1',
              demandEach: 1,
              sale: null,
              unknowns: ['SALE_UNKNOWN'],
            },
          ],
        })
        return true
      }
      return false
    },
  })
  await page.goto(`/app/products/${productId}`)
  await page.getByRole('tab', { name: 'Pricing', exact: true }).click()
  await page.getByRole('tab', { name: 'Preview prices', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Published price list', exact: true })
    .selectOption(versionId)
  const variants = page.getByRole('combobox', {
    name: 'Demand variant 1',
    exact: true,
  })
  await expect(
    variants.getByRole('option', { name: /NOT-IN-PRICE-LIST/ }),
  ).toHaveCount(0)
  await variants.selectOption(variantId)
  await page
    .getByRole('button', { name: 'Calculate preview', exact: true })
    .click()
  await expect(page.getByText(/Incomplete. Known selling amount/)).toBeVisible()
  await expect(
    page.getByRole('cell', { name: 'Selling price is missing', exact: true }),
  ).toBeVisible()
  expect(previews[0]).toMatchObject({
    accountId: 'account',
    warehouseId: 'central',
    agreementId: 'spring',
  })
  expect(previews[0]).not.toHaveProperty('versionId')
})

test('variant correction conflicts preserve edits and require a fresh physical-item confirmation', async ({
  page,
}) => {
  const writes = []
  let revision = 3
  await setup(page, {
    handler: async ({ name, request, reply }) => {
      if (name === path) {
        await reply({ ...product, revision })
        return true
      }
      if (
        name === `${path}/variants` &&
        request.method() === 'GET' &&
        revision === 4
      ) {
        await reply({
          items: [{ ...variant, partCode: 'SERVER-CODE' }],
          next: null,
        })
        return true
      }
      if (name === `${path}/variants` && request.method() === 'POST') {
        writes.push(request.postDataJSON())
        revision = 4
        await reply(
          writes.length === 1
            ? { code: 'VERSION_CONFLICT', message: 'This product changed.' }
            : { ...product, revision: 5 },
          writes.length === 1 ? 409 : 200,
        )
        return true
      }
      return false
    },
  })
  await page.goto(`/app/products/${productId}`)
  await page.getByRole('tab', { name: 'Variants', exact: true }).click()
  await page.getByRole('button', { name: /Correct details for/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog
    .getByRole('textbox', { name: 'Supplier part code', exact: true })
    .fill('NEW-CODE')
  await dialog
    .getByRole('textbox', { name: 'Reason for correction', exact: true })
    .fill('Fix supplier typo')
  await dialog
    .getByRole('checkbox', { name: /This is the same physical item/ })
    .check()
  await dialog
    .getByRole('button', { name: 'Save correction', exact: true })
    .click()
  await expect(
    dialog.getByRole('textbox', { name: 'Supplier part code', exact: true }),
  ).toHaveValue('NEW-CODE')
  await expect(
    dialog.getByRole('cell', { name: 'SERVER-CODE', exact: true }),
  ).toBeVisible()
  await dialog
    .getByRole('button', {
      name: 'Use current revision and keep my edits',
      exact: true,
    })
    .click()
  await expect(
    dialog.getByRole('button', { name: 'Save correction', exact: true }),
  ).toBeDisabled()
  await dialog
    .getByRole('checkbox', { name: /This is the same physical item/ })
    .check()
  await dialog
    .getByRole('button', { name: 'Save correction', exact: true })
    .click()
  await expect(dialog).toHaveCount(0)
  expect(writes.map((body) => body.expectedRevision)).toEqual([3, 4])
  expect(writes[0].changes).toEqual(writes[1].changes)
  expect(writes[1].changes[0]).not.toHaveProperty('units')
})

test('exact variant part-code search escapes punctuation and clears pagination', async ({
  page,
}) => {
  const lookups = []
  await setup(page, {
    handler: async ({ name, url, reply }) => {
      if (name === `${path}/variants`) {
        lookups.push({
          code: url.searchParams.get('partCode'),
          after: url.searchParams.get('after'),
        })
        await reply({
          items: [variant],
          next:
            !url.searchParams.has('after') && !url.searchParams.has('partCode')
              ? 'next-page'
              : null,
        })
        return true
      }
      return false
    },
  })
  await page.goto(`/app/products/${productId}`)
  await page.getByRole('tab', { name: 'Variants', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect
    .poll(() => lookups.some((item) => item.after === 'next-page'))
    .toBe(true)
  await page
    .getByRole('textbox', { name: 'Find by exact part code', exact: true })
    .fill(' A.+[1] ')
  await expect
    .poll(() => lookups.at(-1))
    .toEqual({ code: 'A.+[1]', after: null })
})

test('billing-restricted product editors see variants and prices without correction actions', async ({
  page,
}) => {
  await setup(page, {
    handler: async ({ name, reply }) => {
      if (name.endsWith('/access')) {
        await reply({ writesAllowed: false, state: 'restricted' })
        return true
      }
      return false
    },
  })
  await page.goto(`/app/products/${productId}`)
  await page.getByRole('tab', { name: 'Variants', exact: true }).click()
  await expect(
    page.getByRole('rowheader', { name: /001-DEFAULT/ }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', {
      name: /Correct details|Manage variants|Add variants|Edit options|Edit colors|Add colors/,
    }),
  ).toHaveCount(0)
  await page.getByRole('tab', { name: 'Pricing', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Pricing', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Add pricing', exact: true }),
  ).toHaveCount(0)
})

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
    .getByRole('button', { name: 'Add colors & sizes', exact: true })
    .click()
  await page.getByRole('button', { name: 'Save colors & sizes', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Add variants', exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  await dialog.getByText('Part code & packaging (optional)', { exact: true }).click()
  await dialog
    .getByRole('textbox', {
      name: 'Supplier part code (optional)',
      exact: true,
    })
    .fill('001-DEFAULT')
  await dialog
    .getByRole('checkbox', {
      name: 'Add packaging details',
      exact: true,
    })
    .check()
  await dialog
    .getByRole('textbox', { name: 'Purchase unit', exact: true })
    .fill('carton')
  await dialog
    .getByRole('spinbutton', {
      name: 'Items per purchase unit',
      exact: true,
    })
    .fill('12')
  await dialog
    .getByRole('spinbutton', {
      name: 'Minimum purchase units',
      exact: true,
    })
    .fill('2')
  await dialog
    .getByRole('spinbutton', {
      name: 'Order in multiples of',
      exact: true,
    })
    .fill('1')
  await dialog
    .getByRole('button', { name: 'Save variants', exact: true })
    .click()
  await expect(dialog).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Activate product', exact: true })
    .click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Activate', exact: true })
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
        baseUnit: 'item',
        salesUnit: 'item',
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
    handler: async ({ name, request, reply, url }) => {
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
          items:
            url.searchParams.get('kind') === 'published'
              ? [
                  {
                    id: versionId,
                    revision: 0,
                    intervalRevision: 2,
                    start: '2026-11-01T00:00:00.000Z',
                    ...rules,
                  },
                ]
              : saved
                ? [{ id: scheduleId, revision: 0, ...rules }]
                : [],
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
  await page.getByRole('button', { name: 'Add pricing', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog
    .getByText('Account and warehouse labels', { exact: true })
    .click()
  for (const [label, value] of [
    ['Supplier account label', 'account'],
    ['Warehouse label', 'central'],
    ['Price list name', 'spring'],
    ['Supplier cost per item (USD)', '0.335000'],
  ])
    await dialog.getByRole('textbox', { name: label, exact: true }).fill(value)
  await dialog
    .getByRole('button', { name: 'Add variant price', exact: true })
    .click()
  await dialog
    .getByRole('combobox', { name: 'Pricing variant 1', exact: true })
    .selectOption(variantId)
  await dialog
    .getByRole('textbox', { name: 'Selling price per item (USD)', exact: true })
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
    .getByRole('button', { name: 'Price list to replace', exact: true })
    .click()
  await publication.getByRole('option', { name: /spring/ }).click()
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
    page.getByRole('button', { name: 'Add pricing', exact: true }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Open editor', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(
    dialog.getByRole('textbox', { name: /Supplier cost|Extra supplier cost/ }),
  ).toHaveCount(0)
  await dialog
    .getByRole('textbox', {
      name: `Selling price per item · ${variantId}`,
      exact: true,
    })
    .fill('0')
  await dialog
    .getByRole('button', { name: 'Save pricing draft', exact: true })
    .click()
  await expect(dialog).toHaveCount(0)
  expect(sales).toEqual([
    { expectedRevision: 5, sales: [{ id: variantId, sale: '0' }] },
  ])
  await page.getByRole('tab', { name: 'Preview prices', exact: true }).click()
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
    .getByRole('spinbutton', { name: 'Quantity in items 1', exact: true })
    .fill('3')
  await page
    .getByRole('button', { name: 'Calculate preview', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Goods preview · USD', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('columnheader', { name: 'Cost USD', exact: true }),
  ).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Calculate preview', exact: true })
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
  await page.getByRole('button', { name: 'Create', exact: true }).click()
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
