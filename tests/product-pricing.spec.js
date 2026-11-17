import { expect, test } from '@playwright/test'
import { mockSignedIn } from './helpers/auth'

const org = '507f1f77bcf86cd799439011'
const productId = '507f1f77bcf86cd799439022'
const variantId = '507f1f77bcf86cd799439044'
const tableId = '507f1f77bcf86cd799439055'
const path = `/organizations/${org}/products/${productId}`
const product = {
  id: productId,
  name: 'Classic polo',
  productCode: 'PRD-001',
  status: 'draft',
  revision: 3,
  selectableVariantCount: 1,
  configuration: { mode: 'single', dimensions: [] },
  readiness: { activationBlockers: [] },
}
const draftRef = { id: tableId, revision: 1 }
const currentRef = { versionId: tableId, intervalRevision: 0 }
const empty = () => ({
  productRevision: 3,
  source: { draft: null, current: null },
  draft: null,
  current: null,
  eligibleVariantIds: [variantId],
  blocker: null,
})
const field = (page, name, position = 1) =>
  page.getByRole('textbox', {
    name: `${name}, table 1, break ${position}`,
    exact: true,
  })

async function setup(
  page,
  {
    cost = true,
    writesAllowed = true,
    initial = empty(),
    failFirst = false,
    stale = false,
    outcome = 'current',
  } = {},
) {
  await mockSignedIn(page)
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
  let state = structuredClone(initial)
  const saves = []
  const otherWrites = []
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const name = new URL(request.url()).pathname.replace('/api/v1', '')
    const reply = (data) => route.fulfill({ json: { data } })
    if (name === '/organizations')
      return reply({
        items: [{ id: org, name: 'Acme', status: 'active' }],
        next: null,
      })
    if (name.endsWith('/permissions'))
      return reply({
        owner: false,
        grants: [
          'products.view',
          'products.edit',
          'products.pricing.edit',
          'products.pricing.preview',
          'products.pricing.publish',
          ...(cost ? ['products.pricing.cost'] : []),
        ].map((key) => ({ key, scope: 'all' })),
      })
    if (name.endsWith('/access'))
      return reply({
        writesAllowed,
        state: writesAllowed ? 'normal' : 'restricted',
      })
    if (name === path) return reply(product)
    if (name === `${path}/variants`)
      return reply({
        items: [{ id: variantId, selections: [], partCode: 'POLO' }],
        next: null,
      })
    if (name === `${path}/pricing/tables` && request.method() === 'POST') {
      saves.push({
        body: request.postDataJSON(),
        key: request.headers()['idempotency-key'],
      })
      if (stale)
        return route.fulfill({
          status: 409,
          json: {
            error: {
              code: 'STALE_SOURCES',
              message: 'Pricing changed. Reload and review.',
            },
          },
        })
      if (failFirst && saves.length === 1)
        return route.fulfill({
          status: 503,
          json: {
            error: {
              code: 'TEMPORARY_FAILURE',
              message: 'Save response interrupted.',
            },
          },
        })
      const tables = request.postDataJSON().tables.map((table) => ({
        ...table,
        id: tableId,
        variantIds: [variantId],
        breaks: table.breaks,
      }))
      state = {
        ...state,
        source: { draft: draftRef, current: currentRef },
        draft: tables,
        current: outcome === 'draft' ? state.current : tables,
      }
      return reply({
        productRevision: 3,
        draft: draftRef,
        current: currentRef,
        outcome,
        blockers:
          outcome === 'draft' ? [{ code: 'PUBLISH_PERMISSION_REQUIRED' }] : [],
      })
    }
    if (name === `${path}/pricing/tables`) return reply(state)
    if (!['GET', 'HEAD'].includes(request.method())) otherWrites.push(name)
    return reply({ items: [], next: null })
  })
  await page.goto(`/app/products/${productId}`)
  await page.getByRole('tab', { name: 'Pricing', exact: true }).click()
  return { saves, otherWrites }
}

for (const width of [375, 1440]) {
  test(`simple pricing calculates and saves quantity columns at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 })
    const { saves, otherWrites } = await setup(page)
    await expect(
      page.getByRole('button', { name: 'Save pricing', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('textbox', { name: 'Table name 1', exact: true }),
    ).toBeHidden()
    await field(page, 'Cost').fill('12')
    await field(page, 'Price').fill('20')
    await expect(field(page, 'Margin %')).toHaveValue('40')
    await expect(
      page.getByLabel('Margin amount, table 1, break 1', { exact: true }),
    ).toHaveText('8.00')
    await field(page, 'Margin %').fill('40')
    await field(page, 'Cost').fill('15')
    await expect(field(page, 'Price')).toHaveValue('25')
    await page
      .getByRole('button', { name: 'Add quantity', exact: true })
      .click()
    await field(page, 'Qty', 2).fill('50')
    await field(page, 'Cost', 2).fill('0.1')
    await field(page, 'Price', 2).fill('0.3')
    await expect
      .poll(() =>
        field(page, 'Price', 2).evaluate((input) => {
          const bounds = input.getBoundingClientRect()
          const grid = input
            .closest('.simple-price-rows')
            .getBoundingClientRect()
          return bounds.left >= grid.left - 1 && bounds.right <= grid.right + 1
        }),
      )
      .toBe(true)
    await expect(
      page.getByLabel('Margin amount, table 1, break 2', { exact: true }),
    ).toHaveText('0.20')
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({
      path: `test-results/pricing-${width}.png`,
      fullPage: true,
    })
    await page
      .getByRole('button', { name: 'Save pricing', exact: true })
      .click()
    await expect(
      page.getByText('Pricing saved and current.', { exact: true }),
    ).toBeVisible()
    expect(saves[0].body).toEqual({
      productRevision: 3,
      source: { draft: null, current: null },
      tables: [
        {
          name: 'Standard',
          applicability: { mode: 'all' },
          breaks: [
            { from: 1, cost: '15', intent: { driver: 'margin', value: '40' } },
            {
              from: 50,
              cost: '0.1',
              intent: { driver: 'price', value: '0.3' },
            },
          ],
        },
      ],
    })
    expect(saves[0].key).toBeTruthy()
    await expect(field(page, 'Cost')).toHaveValue('15')
    await expect(field(page, 'Price')).toHaveValue('25')
    expect(otherWrites).toEqual([])
  })
}

test('uncertain save freezes edits and retries the original body and key', async ({
  page,
}) => {
  const { saves } = await setup(page, { failFirst: true })
  await field(page, 'Cost').fill('12')
  await field(page, 'Price').fill('20')
  await page.getByRole('button', { name: 'Save pricing', exact: true }).click()
  await expect(field(page, 'Cost')).toBeDisabled()
  await page.getByRole('button', { name: 'Retry save', exact: true }).click()
  await expect(
    page.getByText('Pricing saved and current.', { exact: true }),
  ).toBeVisible()
  expect(saves).toHaveLength(2)
  expect(saves[1]).toEqual(saves[0])
})

test('duplicate quantities and invalid margin are blocked before save', async ({
  page,
}) => {
  const { saves } = await setup(page)
  await field(page, 'Cost').fill('12')
  await field(page, 'Margin %').fill('100')
  await page.getByRole('button', { name: 'Save pricing', exact: true }).click()
  await expect(page.getByRole('alert').first()).toContainText('less than 100')
  await field(page, 'Margin %').fill('40')
  await page.getByRole('button', { name: 'Add quantity', exact: true }).click()
  await field(page, 'Qty', 2).fill('1')
  await page.getByRole('button', { name: 'Save pricing', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(
    'quantities must increase',
  )
  expect(saves).toHaveLength(0)
})

test('sale-only pricing hides costs and both margin fields', async ({
  page,
}) => {
  const initial = empty()
  initial.current = [
    {
      id: tableId,
      name: 'Standard',
      variantIds: [variantId],
      breaks: [{ from: 1, maxExclusive: 1000001, price: '20' }],
    },
  ]
  const { saves } = await setup(page, { cost: false, initial })
  await expect(field(page, 'Price')).toHaveValue('20')
  await expect(field(page, 'Price')).toBeDisabled()
  await expect(field(page, 'Cost')).toHaveCount(0)
  await expect(field(page, 'Margin %')).toHaveCount(0)
  await expect(
    page.getByLabel('Margin amount, table 1, break 1', { exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Save pricing', exact: true }),
  ).toHaveCount(0)
  expect(saves).toHaveLength(0)
})

test('stale pricing requires reload before another save', async ({ page }) => {
  const { saves } = await setup(page, { stale: true })
  await field(page, 'Cost').fill('12')
  await field(page, 'Price').fill('20')
  await page.getByRole('button', { name: 'Save pricing', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Pricing changed')
  await expect(
    page.getByRole('button', { name: 'Save pricing', exact: true }),
  ).toBeDisabled()
  await expect(field(page, 'Cost')).toHaveValue('12')
  await page
    .getByRole('button', { name: 'Reload latest data', exact: true })
    .click()
  await expect(field(page, 'Cost')).toHaveValue('')
  expect(saves).toHaveLength(1)
})

test('billing restriction keeps saved pricing read-only', async ({ page }) => {
  const initial = empty()
  initial.current = [
    {
      id: tableId,
      name: 'Standard',
      variantIds: [variantId],
      breaks: [
        {
          from: 1,
          cost: '12',
          price: '20',
          intent: { driver: 'price', value: '20' },
        },
      ],
    },
  ]
  await setup(page, { writesAllowed: false, initial })
  await expect(field(page, 'Cost')).toHaveValue('12')
  await expect(field(page, 'Cost')).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Save pricing', exact: true }),
  ).toHaveCount(0)
})

test('saved margin intent and selected variants round-trip through a draft save', async ({
  page,
}) => {
  const initial = empty()
  initial.source.draft = draftRef
  initial.draft = [
    {
      id: tableId,
      name: 'Standard',
      variantIds: [variantId],
      breaks: [
        {
          from: 1,
          cost: '2',
          price: '3.333333',
          margin: '39.999994',
          intent: { driver: 'margin', value: '40' },
        },
      ],
    },
  ]
  const { saves } = await setup(page, { initial, outcome: 'draft' })
  await expect(field(page, 'Margin %')).toHaveValue('40')
  await field(page, 'Cost').fill('3')
  await expect(field(page, 'Price')).toHaveValue('5')
  await page.getByRole('button', { name: 'Save pricing', exact: true }).click()
  await expect(
    page.getByText('Draft saved. Current prices have not changed.', {
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    page.getByText(/Someone with pricing publish access/),
  ).toBeVisible()
  expect(saves[0].body.source).toEqual(initial.source)
  expect(saves[0].body.tables[0].applicability).toEqual({
    mode: 'selected',
    variantIds: [variantId],
  })
  expect(saves[0].body.tables[0].breaks[0].intent).toEqual({
    driver: 'margin',
    value: '40',
  })
  await expect(field(page, 'Price')).toHaveValue('5')
})

test('variant selection only changes pricing applicability', async ({
  page,
}) => {
  const { saves, otherWrites } = await setup(page)
  await page.locator('summary').filter({ hasText: 'Pricing options' }).click()
  await page.getByRole('button', { name: 'Applies to 1', exact: true }).click()
  await page
    .getByRole('option', { name: 'Selected variants', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Variants for table 1', exact: true })
    .click()
  await page.getByRole('option', { name: /Standard variant/ }).click()
  await page
    .getByRole('searchbox', { name: 'Search…', exact: true })
    .press('Escape')
  await field(page, 'Cost').fill('12')
  await field(page, 'Price').fill('20')
  await page.getByRole('button', { name: 'Save pricing', exact: true }).click()
  await expect(
    page.getByText('Pricing saved and current.', { exact: true }),
  ).toBeVisible()
  expect(saves[0].body.tables[0].applicability).toEqual({
    mode: 'selected',
    variantIds: [variantId],
  })
  expect(otherWrites).toEqual([])
})
