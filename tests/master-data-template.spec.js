import { expect, test } from '@playwright/test'
import { mockSignedIn } from './helpers/auth'

const initialEntries = [
  {
    category: 'decoration_location',
    key: 'front',
    label: 'Front',
    description: null,
    sortOrder: 0,
    status: 'active',
  },
  {
    category: 'industry',
    key: 'education',
    label: 'Education',
    description: null,
    sortOrder: 0,
    status: 'active',
  },
  {
    category: 'product_category',
    key: 'drinkware',
    label: 'Drinkware',
    description: null,
    sortOrder: 0,
    status: 'active',
  },
  {
    category: 'decoration_method',
    key: 'screen_print',
    label: 'Screen printing',
    description: null,
    sortOrder: 0,
    status: 'active',
  },
]

test.beforeEach(async ({ page }) => {
  await mockSignedIn(page)
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
})

async function mockTemplates(page, { interruptFirst = false, entries = initialEntries } = {}) {
  let draft = {
    revision: 4,
    version: 2,
    entries: structuredClone(entries),
  }
  const writes = []
  const publications = []
  await page.route('**/api/v1/**', (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path.endsWith('/admin/me'))
      return route.fulfill({ json: { data: { role: 'super_admin' } } })
    if (path.endsWith('/master-data/draft')) {
      if (request.method() === 'PUT') {
        writes.push({
          body: request.postDataJSON(),
          key: request.headers()['idempotency-key'],
        })
        if (interruptFirst && writes.length === 1)
          return route.fulfill({
            status: 503,
            json: {
              error: {
                code: 'SERVICE_UNAVAILABLE',
                message: 'Please retry the original save.',
              },
            },
          })
        draft = {
          ...draft,
          entries: request.postDataJSON().entries,
          revision: draft.revision + 1,
        }
      }
      return route.fulfill({ json: { data: draft } })
    }
    if (path.endsWith('/master-data/publish'))
      publications.push(request.postDataJSON())
    return route.fulfill({ json: { data: { items: [], next: null } } })
  })
  return { writes, publications }
}

test('entry forms save the chosen category without publishing or replacing other categories', async ({
  page,
}) => {
  const { writes, publications } = await mockTemplates(page)
  await page.goto('/admin?section=masterData')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  let dialog = page.getByRole('dialog')
  await dialog
    .getByRole('textbox', { name: 'Name', exact: true })
    .fill('Cancelled entry')
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  const confirmation = page.getByRole('dialog', { name: 'Discard changes?', exact: true })
  await confirmation.getByRole('button', { name: 'Keep editing', exact: true }).click()
  await expect(
    dialog.getByRole('textbox', { name: 'Name', exact: true }),
  ).toHaveValue('Cancelled entry')
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await confirmation.getByRole('button', { name: 'Discard', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(writes).toHaveLength(0)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('Category').click()
  await page.getByRole('option', { name: 'Decoration methods', exact: true }).click()
  await dialog
    .getByRole('textbox', { name: 'Name', exact: true })
    .fill('  Laser engraving  ')
  await dialog.getByRole('button', { name: 'Save to draft' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('tabpanel')).toContainText('Laser engraving')
  expect(writes[0].body.expectedRevision).toBe(4)
  expect(writes[0].body.entries).toEqual(expect.arrayContaining(initialEntries))
  expect(writes[0].body.entries).toContainEqual({
    category: 'decoration_method',
    key: 'laser_engraving',
    label: 'Laser engraving',
    description: null,
    sortOrder: 0,
    status: 'active',
  })
  expect(publications).toHaveLength(0)
  await page.getByRole('button', { name: 'Edit Laser engraving' }).click()
  await page
    .getByRole('dialog')
    .getByRole('textbox', { name: 'Name', exact: true })
    .fill('Laser marking')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Save to draft' })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(writes[1].body.expectedRevision).toBe(5)
  expect(writes[1].body.entries).toHaveLength(5)
  expect(
    writes[1].body.entries.find((entry) => entry.key === 'laser_engraving')
      .label,
  ).toBe('Laser marking')
})

test('an interrupted dialog save locks its draft and retries the original operation', async ({
  page,
}) => {
  const { writes } = await mockTemplates(page, { interruptFirst: true })
  await page.goto('/admin?section=masterData')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog
    .getByRole('textbox', { name: 'Name', exact: true })
    .fill('Healthcare')
  await dialog.getByRole('button', { name: 'Save to draft' }).click()
  await expect(
    dialog.getByRole('button', { name: 'Retry same request' }),
  ).toBeVisible()
  await expect(
    dialog.getByRole('textbox', { name: 'Name', exact: true }),
  ).toBeDisabled()
  await expect(
    dialog.getByRole('button', { name: 'Cancel', exact: true }),
  ).toBeDisabled()
  await dialog.getByRole('button', { name: 'Retry same request' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(writes).toHaveLength(2)
  expect(writes[1]).toEqual(writes[0])
  expect(writes[0].key).toMatch(/^[a-f\d-]{36}$/)
})

test('template search, status filters and keyboard categories keep edits separate from browsing', async ({ page }) => {
  const { writes, publications } = await mockTemplates(page, {
    entries: [
      ...initialEntries,
      { category: 'industry', key: 'healthcare', label: 'Healthcare', description: 'Hospitals and clinics', sortOrder: 1, status: 'active' },
      { category: 'industry', key: 'retail', label: 'Retail', description: 'Stores and brands', sortOrder: 2, status: 'archived' },
    ],
  })
  await page.goto('/admin?section=masterData')
  const panel = page.getByRole('tabpanel')
  const search = page.getByRole('textbox', { name: 'Search industries' })
  await expect(panel.getByRole('row')).toHaveCount(4)
  await search.fill('  CLINICS  ')
  await expect(panel.getByRole('row')).toHaveCount(2)
  await expect(panel).toContainText('Healthcare')
  await page.getByRole('button', { name: 'Clear search', exact: true }).click()
  await page.getByRole('button', { name: 'Filter entries by status' }).click()
  await page.getByRole('option', { name: 'Archived', exact: true }).click()
  await expect(panel.getByRole('row')).toHaveCount(2)
  await expect(panel).toContainText('Retail')
  await search.fill('Education')
  await expect(panel.getByRole('heading', { name: 'No matching entries' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  await expect(panel.getByRole('row')).toHaveCount(4)
  await search.fill('unmatched')
  const industries = page.getByRole('tab', { name: 'Industries', exact: true })
  await industries.focus()
  await industries.press('ArrowRight')
  const products = page.getByRole('tab', { name: 'Product categories', exact: true })
  await expect(products).toBeFocused()
  await expect(products).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('textbox', { name: 'Search product categories' })).toHaveValue('')
  await expect(panel).toContainText('Drinkware')
  await products.press('End')
  await expect(page.getByRole('tab', { name: 'Decoration locations', exact: true })).toBeFocused()
  await page.keyboard.press('Home')
  await expect(industries).toBeFocused()
  expect(writes).toHaveLength(0)
  expect(publications).toHaveLength(0)
})

test('template entries remain readable on narrow screens', async ({ page }) => {
  await mockTemplates(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin?section=masterData')
  const table = page.getByRole('table', { name: 'Industries entries' })
  await expect(table.getByRole('cell', { name: 'Education', exact: true })).toBeVisible()
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    const name = await table.locator('tbody td').first().boundingBox()
    const edit = await page.getByRole('button', { name: 'Edit Education', exact: true }).boundingBox()
    expect(name.width).toBeGreaterThan(140)
    expect(edit.width).toBeGreaterThanOrEqual(44)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
  }
  await page.getByRole('button', { name: 'Edit Education', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Education')
})

async function mockTemplateHistory(page) {
  await mockTemplates(page)
  const reads = []
  await page.route('**/api/v1/admin/master-data/history**', (route) => {
    const url = new URL(route.request().url())
    reads.push({ type: 'activity', action: url.searchParams.get('action'), after: url.searchParams.get('after') })
    const items = Array.from({ length: 10 }, (_, index) => ({
      id: `event_${url.searchParams.get('after') || 'first'}_${index}`,
      action: url.searchParams.get('action') || (index % 2 ? 'master.draft' : 'master.publish'),
      actor: { label: 'Alex Morgan', membershipStatus: 'active' },
      occurredAt: '2026-11-22T04:30:00Z',
      beforeRevision: 3,
      afterRevision: 4,
      reason: 'Reviewed the starter entries for new workspaces.',
      changes: Array.from({ length: 20 }, (_, change) => ({ field: `Entry ${change}`, before: 'Previous value', after: { label: 'Reviewed value' } })),
    }))
    return route.fulfill({ json: { data: { items, next: url.searchParams.get('after') ? null : 'next-events', coverageStartedAt: '2026-10-01T00:00:00Z' } } })
  })
  await page.route('**/api/v1/admin/master-data/versions**', (route) => {
    const url = new URL(route.request().url())
    reads.push({ type: 'versions', after: url.searchParams.get('after') })
    if (url.pathname.endsWith('/versions/publication_0')) {
      return route.fulfill({ json: { data: { version: 12, entries: initialEntries, publication: { evidence: 'retained', publisher: { label: 'Alex Morgan' }, reason: 'Reviewed publication' } } } })
    }
    const items = Array.from({ length: 10 }, (_, index) => ({ id: `publication_${index}`, version: 12 - index, entries: initialEntries }))
    return route.fulfill({ json: { data: { items, next: url.searchParams.get('after') ? null : 'next-versions' } } })
  })
  return reads
}

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test(`template history stays bounded and keeps paging visible at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    const reads = await mockTemplateHistory(page)
    await page.goto('/admin?section=masterData')
    const activityButton = page.getByRole('button', { name: 'Platform template activity', exact: true })
    await expect(activityButton).toBeVisible()
    expect(reads).toHaveLength(0)
    const editorHeight = await page.locator('.master-templates').evaluate((node) => node.getBoundingClientRect().height)
    const scrollPosition = await page.evaluate(() => window.scrollY)
    await activityButton.click()
    const dialog = page.getByRole('dialog', { name: 'Template history', exact: true })
    const list = dialog.getByRole('region', { name: 'Template activity list', exact: true })
    const events = list.locator('.master-template-activity-event')
    await expect(events).toHaveCount(10)
    expect((await events.first().locator('.master-template-event-copy').boundingBox()).width).toBeGreaterThan(180)
    const initialBox = await dialog.boundingBox()
    await events.first().locator('summary').click()
    await expect(events.first().getByText('{"label":"Reviewed value"}', { exact: true }).first()).toBeVisible()
    const expandedBox = await dialog.boundingBox()
    expect(Math.abs(expandedBox.height - initialBox.height)).toBeLessThan(1)
    expect(expandedBox.y).toBeGreaterThanOrEqual(15)
    expect(expandedBox.y + expandedBox.height).toBeLessThanOrEqual(viewport.height - 15)
    expect(await page.locator('.master-templates').evaluate((node) => node.getBoundingClientRect().height)).toBe(editorHeight)
    await expect(dialog.getByRole('button', { name: 'Next', exact: true })).toBeInViewport()
    await list.evaluate((node) => { node.scrollTop = node.scrollHeight })
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollPosition)
    await dialog.screenshot({ path: test.info().outputPath(`activity-${viewport.width}.png`) })
    await dialog.getByRole('button', { name: 'Next', exact: true }).click()
    await expect.poll(() => reads.at(-1)).toMatchObject({ type: 'activity', after: 'next-events' })
    await dialog.getByRole('button', { name: 'Activity type', exact: true }).click()
    await page.getByRole('option', { name: 'Draft updates', exact: true }).click()
    await expect.poll(() => reads.at(-1)).toMatchObject({ type: 'activity', action: 'master.draft', after: null })
    await dialog.getByRole('tab', { name: 'Published versions', exact: true }).click()
    await expect(dialog.getByRole('button', { name: 'View publication', exact: true })).toHaveCount(10)
    await expect(dialog.getByRole('button', { name: 'Next', exact: true })).toBeInViewport()
    await dialog.screenshot({ path: test.info().outputPath(`versions-${viewport.width}.png`) })
    await dialog.getByRole('button', { name: 'View publication', exact: true }).first().click()
    const publication = page.getByRole('dialog', { name: 'Published template', exact: true })
    await expect(publication).toContainText('Reviewed publication')
    await publication.getByRole('button', { name: 'Close dialog' }).click()
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(activityButton).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width)
  })
}
