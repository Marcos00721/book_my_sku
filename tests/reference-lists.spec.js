import { expect, test } from '@playwright/test'
import { mockSignedIn } from './helpers/auth'

const org = '507f1f77bcf86cd799439011'
const root = `/api/v1/organizations/${org}/master-data`
const entry = {
  id: '507f1f77bcf86cd799439022', label: 'Education',
  description: 'Schools and universities', sortOrder: 10,
  status: 'active', revision: 3, source: { version: 2, key: 'education' },
}

async function setup(page, { owner = true, writesAllowed = true, respond } = {}) {
  const writes = []
  const reads = []
  await mockSignedIn(page)
  await page.route('https://fonts.googleapis.com/**', route => route.abort())
  await page.route('https://fonts.gstatic.com/**', route => route.abort())
  await page.route('**/api/v1/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const reply = data => route.fulfill({ json: { data } })
    if (url.pathname === '/api/v1/organizations')
      return reply({ items: [{ id: org, name: 'Acme workspace', status: 'active' }], next: null })
    if (url.pathname.endsWith('/permissions'))
      return reply({ owner, grants: [{ key: 'master_data.view', scope: 'all' }] })
    if (url.pathname.endsWith('/access')) return reply({ writesAllowed, state: 'normal' })
    if (url.pathname.startsWith(root)) {
      if (request.method() === 'GET') reads.push(url)
      else writes.push({ path: url.pathname, method: request.method(), body: request.postDataJSON(), key: request.headers()['idempotency-key'] })
      if (respond && await respond({ route, request, url, reply, writes })) return
      if (request.method() !== 'GET') return reply({ ...entry, ...request.postDataJSON() })
      if (url.pathname.endsWith('/history')) return reply({ items: [], next: null })
      return reply({ items: [entry], next: null })
    }
    return reply({ items: [], next: null })
  })
  return { writes, reads }
}

test('each category has a specific create and edit title and saves to its own endpoint', async ({ page }) => {
  const { writes } = await setup(page)
  await page.goto('/app/master-data')
  for (const [tab, singular, category] of [
    ['Industries', 'industry', 'industry'],
    ['Product categories', 'product category', 'product_category'],
    ['Decoration methods', 'decoration method', 'decoration_method'],
    ['Decoration locations', 'decoration location', 'decoration_location'],
  ]) {
    await page.getByRole('tab', { name: tab, exact: true }).click()
    await page.locator('.page-heading').getByRole('button', { name: `Create ${singular}`, exact: true }).click()
    const dialog = page.getByRole('dialog', { name: `Create ${singular}`, exact: true })
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Name', { exact: true }).fill('  New choice  ')
    await dialog.getByLabel('Description', { exact: true }).fill('  Team choice  ')
    await expect(dialog.getByLabel('Sort order', { exact: true })).toHaveCount(0)
    await dialog.getByRole('button', { name: `Create ${singular}`, exact: true }).click()
    await expect(dialog).toHaveCount(0)
    expect(writes.at(-1)).toMatchObject({ path: `${root}/${category}`, method: 'POST', body: { label: 'New choice', description: 'Team choice', sortOrder: 110 } })
    await page.getByRole('button', { name: 'Edit Education', exact: true }).click()
    const edit = page.getByRole('dialog', { name: `Edit ${singular}`, exact: true })
    await expect(edit.getByLabel('Name', { exact: true })).toHaveValue('Education')
    await edit.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(edit).toHaveCount(0)
    expect(writes.at(-1)).toMatchObject({ path: `${root}/${category}/${entry.id}`, method: 'PATCH', body: { expectedRevision: 3 } })
    expect(writes.at(-1).body).not.toHaveProperty('sortOrder')
  }
})

test('invalid drafts show inline validation, focus the error and never send a write', async ({ page }) => {
  const { writes } = await setup(page)
  await page.goto('/app/master-data')
  await page.getByRole('button', { name: 'Create industry', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const name = dialog.getByLabel('Name', { exact: true })
  await name.fill('   ')
  await dialog.getByRole('button', { name: 'Create industry', exact: true }).click()
  await expect(dialog.getByText('Enter a name.', { exact: true })).toBeVisible()
  await expect(name).toBeFocused()
  await expect(name).toHaveAttribute('aria-invalid', 'true')
  await name.fill('Healthcare')
  expect(writes).toHaveLength(0)
  await expect(dialog.getByRole('spinbutton')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Create industry', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(writes).toHaveLength(1)
  expect(writes[0].body).toEqual({ label: 'Healthcare', description: null, sortOrder: 110 })
})

test('interrupted saves lock the draft and retry the same operation', async ({ page }) => {
  const { writes } = await setup(page, { respond: async ({ route, request, writes }) => {
    if (request.method() !== 'GET' && writes.length === 1) {
      await route.fulfill({ status: 503, json: { error: { code: 'SERVICE_UNAVAILABLE', message: 'Please retry.' } } })
      return true
    }
    return false
  } })
  await page.goto('/app/master-data')
  await page.getByRole('button', { name: 'Create industry', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Name', { exact: true }).fill('Healthcare')
  await dialog.getByRole('button', { name: 'Create industry', exact: true }).click()
  await expect(dialog.getByLabel('Name', { exact: true })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Retry same request', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(writes).toHaveLength(2)
  expect(writes[1]).toEqual(writes[0])
})

test('server field errors preserve the draft and allow correction', async ({ page }) => {
  const { writes } = await setup(page, { respond: async ({ route, request, writes }) => {
    if (request.method() !== 'GET' && writes.length === 1) {
      await route.fulfill({ status: 400, json: { error: {
        code: 'INVALID_REQUEST', message: 'Correct the highlighted fields.',
        fields: [{ field: 'label', message: 'An active label already exists in this category.' }],
      } } })
      return true
    }
    return false
  } })
  await page.goto('/app/master-data')
  await page.getByRole('button', { name: 'Edit Education' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Name', { exact: true }).fill('Duplicate')
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveAttribute('aria-invalid', 'true')
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Duplicate')
  await dialog.getByLabel('Name', { exact: true }).fill('Unique name')
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(writes[1].body.label).toBe('Unique name')
})

test('search and status reset cursor pagination and activity hides create', async ({ page }) => {
  const { reads } = await setup(page, { respond: async ({ url, reply }) => {
    if (url.pathname !== `${root}/industry`) return false
    await reply({ items: [{ ...entry, label: url.searchParams.has('after') ? 'Next entry' : 'Education' }], next: url.searchParams.has('after') ? null : 'opaque-cursor' })
    return true
  } })
  await page.goto('/app/master-data')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit Next entry' })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search industries' }).fill('  Health  ')
  await expect.poll(() => reads.at(-1)?.searchParams.get('search')).toBe('Health')
  expect(reads.at(-1).searchParams.has('after')).toBe(false)
  await page.getByRole('button', { name: 'Status', exact: true }).click()
  await page.getByRole('option', { name: 'Archived', exact: true }).click()
  await expect.poll(() => reads.at(-1)?.searchParams.get('status')).toBe('archived')
  expect(reads.at(-1).searchParams.has('after')).toBe(false)
  await page.getByRole('tab', { name: 'Product categories', exact: true }).click()
  await expect(page.getByRole('searchbox', { name: 'Search product categories' })).toHaveValue('')
  await expect.poll(() => reads.at(-1)?.pathname).toBe(`${root}/product_category`)
  expect(reads.at(-1).searchParams.get('status')).toBe('active')
  expect(reads.at(-1).searchParams.has('search')).toBe(false)
  await page.getByRole('tab', { name: 'Activity', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Create / })).toHaveCount(0)
})

test('conflict review preserves edits and saves against the reviewed revision', async ({ page }) => {
  const { writes } = await setup(page, { respond: async ({ route, request, url, reply, writes }) => {
    if (request.method() === 'PATCH' && writes.length === 1) {
      await route.fulfill({ status: 409, json: { error: { code: 'VERSION_CONFLICT', message: 'This entry changed.' } } })
      return true
    }
    if (request.method() === 'GET' && url.pathname === `${root}/industry/${entry.id}`) {
      await reply({ ...entry, label: 'Updated by teammate', revision: 4 })
      return true
    }
    return false
  } })
  await page.goto('/app/master-data')
  await page.getByRole('button', { name: 'Edit Education', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Name', { exact: true }).fill('My draft')
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
  const review = dialog.getByRole('region', { name: 'Review conflicting changes' })
  await expect(review.getByText('Updated by teammate', { exact: true })).toBeVisible()
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('My draft')
  await review.getByRole('button', { name: 'Use current revision and keep my edits' }).click()
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(writes[1].body).toMatchObject({ label: 'My draft', expectedRevision: 4 })
})

test('archive and restore confirm the entry name and retain revision checks', async ({ page }) => {
  let status = 'active'
  const { writes } = await setup(page, { respond: async ({ request, url, reply }) => {
    if (request.method() === 'POST') {
      status = url.pathname.endsWith('/archive') ? 'archived' : 'active'
      await reply({ ...entry, status })
      return true
    }
    if (url.pathname === `${root}/industry`) {
      await reply({ items: [{ ...entry, status }], next: null })
      return true
    }
    return false
  } })
  await page.goto('/app/master-data')
  for (const action of ['Archive', 'Restore']) {
    await page.getByRole('button', { name: `${action} Education`, exact: true }).click()
    const confirmation = page.getByRole('dialog', { name: `${action} “Education”?`, exact: true })
    await expect(confirmation).toBeVisible()
    await confirmation.getByRole('button', { name: action, exact: true }).click()
    await expect(confirmation).toHaveCount(0)
    await expect.poll(() => writes.at(-1)?.path).toBe(`${root}/industry/${entry.id}/${action.toLowerCase()}`)
    expect(writes.at(-1).body).toEqual({ expectedRevision: 3 })
  }
})

test('empty search gives useful recovery without displaying a false empty state on failure', async ({ page }) => {
  await setup(page, { respond: async ({ route, url, reply }) => {
    if (url.pathname !== `${root}/industry`) return false
    if (url.searchParams.has('search')) {
      await reply({ items: [], next: null })
    } else {
      await route.fulfill({ status: 500, json: { error: { code: 'INTERNAL_ERROR', message: 'Cannot load industries.' } } })
    }
    return true
  } })
  await page.goto('/app/master-data')
  await expect(page.getByRole('alert')).toContainText('Cannot load industries.')
  await expect(page.locator('.empty-state')).toHaveCount(0)
  await page.getByRole('searchbox', { name: 'Search industries' }).fill('No match')
  await expect(page.getByRole('heading', { name: 'No matching entries' })).toBeVisible()
  await page.locator('.empty-state').getByRole('button', { name: 'Clear filters' }).click()
  await expect(page.getByRole('searchbox', { name: 'Search industries' })).toHaveValue('')
})

for (const access of [{ owner: false }, { writesAllowed: false }]) {
  test(`reference lists respect ${JSON.stringify(access)} access`, async ({ page }) => {
    await setup(page, access)
    await page.goto('/app/master-data')
    await expect(page.getByRole('table', { name: 'Industries' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Create |^Edit |^Archive |^Restore / })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Reorder / })).toHaveCount(0)
  })
}

test('listing and editor fit mobile and desktop in both themes', async ({ page }, testInfo) => {
  await setup(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/app/master-data')
  await expect(page.getByRole('table', { name: 'Industries' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('reference-list-desktop.png'), fullPage: true })
  for (const dark of [false, true]) {
    await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark)
    await page.setViewportSize({ width: 390, height: 844 })
    const row = page.getByRole('table', { name: 'Industries' }).getByRole('row').last()
    await expect(row.getByRole('button', { name: 'Edit Education' })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`reference-list-mobile-${dark ? 'dark' : 'light'}.png`), fullPage: true })
    await page.locator('.page-heading').getByRole('button', { name: 'Create industry', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Create industry', exact: true })
    await expect(dialog).toBeVisible()
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`reference-editor-${dark ? 'dark' : 'light'}.png`) })
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  }
})

async function setupOrdering(page, { interrupt = false, conflict = false, count = 3 } = {}) {
  const categories = new Map()
  const replays = new Map()
  let interrupted = false
  const result = await setup(page, { respond: async ({ request, url, reply, route, writes }) => {
    const [, category, id] = url.pathname.slice(root.length).split('/')
    if (!category || category === 'history') return false
    if (!categories.has(category)) categories.set(category, Array.from({ length: count }, (_, index) => ({
      ...entry,
      id: `507f1f77bcf86cd7994390${String(index + 22).padStart(2, '0')}`,
      label: ['Education', 'Healthcare', 'Retail'][index] || `Reference ${String(index).padStart(2, '0')}`,
      sortOrder: count > 3 ? index * 100 : 0,
    })))
    const items = categories.get(category)
    if (request.method() === 'PATCH') {
      const key = request.headers()['idempotency-key']
      if (replays.has(key)) {
        await reply(replays.get(key))
        return true
      }
      const item = items.find(item => item.id === id)
      const payload = request.postDataJSON()
      if ((conflict && writes.length === 2) || item.revision !== payload.expectedRevision) {
        await route.fulfill({ status: 409, json: { error: { code: 'MASTER_DATA_VERSION_CONFLICT', message: 'This entry changed.' } } })
        return true
      }
      Object.assign(item, { sortOrder: payload.sortOrder, revision: item.revision + 1 })
      replays.set(key, { ...item })
      if (interrupt && !interrupted && writes.length === 2) {
        interrupted = true
        await route.fulfill({ status: 503, json: { error: { code: 'SERVICE_UNAVAILABLE', message: 'The response was interrupted.' } } })
        return true
      }
      await reply(item)
      return true
    }
    if (request.method() === 'GET' && !id) {
      const ordered = [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
      const start = Number(url.searchParams.get('after') || 0)
      const limit = Number(url.searchParams.get('limit') || 25)
      await reply({ items: ordered.slice(start, start + limit), next: start + limit < ordered.length ? String(start + limit) : null })
      return true
    }
    return false
  } })
  return { ...result, categories }
}

test('dragging persists the order in every reference category, including tied positions', async ({ page }) => {
  const { writes } = await setupOrdering(page)
  await page.goto('/app/master-data')
  for (const [tab, category] of [
    ['Industries', 'industry'], ['Product categories', 'product_category'],
    ['Decoration methods', 'decoration_method'], ['Decoration locations', 'decoration_location'],
  ]) {
    await page.getByRole('tab', { name: tab, exact: true }).click()
    const table = page.getByRole('table', { name: tab, exact: true })
    await page.getByRole('button', { name: 'Reorder Retail', exact: true }).dragTo(
      table.locator('tbody tr').first().locator('td').nth(1),
    )
    await expect(page.getByRole('status').filter({ hasText: 'Order saved.' })).toBeVisible()
    await expect(table.locator('tbody .reference-entry-name strong')).toHaveText(['Retail', 'Education', 'Healthcare'])
    expect(writes.filter(write => write.path.startsWith(`${root}/${category}/`))).toHaveLength(2)
    await page.reload()
    if (category !== 'industry') await page.getByRole('tab', { name: tab, exact: true }).click()
    await expect(page.getByRole('table', { name: tab }).locator('tbody .reference-entry-name strong')).toHaveText(['Retail', 'Education', 'Healthcare'])
  }
  for (const write of writes) {
    expect(write.body.expectedRevision).toBe(3)
    expect(Object.keys(write.body).sort()).toEqual(['expectedRevision', 'sortOrder'])
  }
})

test('react-draggable shows the picked-up entry following the pointer and its drop destination', async ({ page }, testInfo) => {
  const { writes } = await setupOrdering(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/app/master-data')
  const handle = page.getByRole('button', { name: 'Reorder Retail', exact: true })
  const source = await handle.boundingBox()
  const table = page.getByRole('table', { name: 'Industries', exact: true })
  const target = await table.locator('tbody tr').first().locator('td').nth(1).boundingBox()
  const preview = page.locator('.reference-drag-preview')
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  await expect(preview).toBeVisible()
  await expect(preview.locator('strong')).toHaveText('Retail')
  await expect(handle).toHaveAttribute('aria-pressed', 'true')
  await expect(table.locator('.reference-row-dragging strong')).toHaveText('Retail')
  const initial = await preview.boundingBox()
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 8 })
  await expect(preview).toContainText('Drop before Education')
  const moved = await preview.boundingBox()
  expect(Math.abs(moved.x - initial.x) + Math.abs(moved.y - initial.y)).toBeGreaterThan(20)
  await expect(table.locator('tbody tr').first()).toHaveClass(/reference-row-drop-before/)
  await expect(table.locator('tbody .reference-entry-name strong')).toHaveText(['Education', 'Healthcare', 'Retail'])
  expect(writes).toHaveLength(0)
  for (const dark of [false, true]) {
    await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark)
    await page.screenshot({ path: testInfo.outputPath(`reference-drag-preview-${dark ? 'dark' : 'light'}.png`), fullPage: true })
  }
  await page.mouse.up()
  await expect(preview).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'Order saved.' })).toBeVisible()
  await expect(table.locator('tbody .reference-entry-name strong')).toHaveText(['Retail', 'Education', 'Healthcare'])
})

test('Escape and dropping outside the table cancel a drag without saving', async ({ page }) => {
  const { writes } = await setupOrdering(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/app/master-data')
  const source = await page.getByRole('button', { name: 'Reorder Retail', exact: true }).boundingBox()
  const target = await page.getByRole('table').locator('tbody tr').first().locator('td').nth(1).boundingBox()
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2)
  await expect(page.locator('.reference-drag-preview')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.reference-drag-preview')).toHaveCount(0)
  await page.mouse.up()
  await expect(page.getByRole('table').locator('.reference-row-dragging')).toHaveCount(0)
  expect(writes).toHaveLength(0)
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  await page.mouse.move(20, 20)
  await expect(page.locator('.reference-drag-preview')).toContainText('Move over a row to drop')
  await page.mouse.up()
  await expect(page.locator('.reference-drag-preview')).toHaveCount(0)
  await expect(page.getByRole('table').locator('tbody .reference-entry-name strong')).toHaveText(['Education', 'Healthcare', 'Retail'])
  expect(writes).toHaveLength(0)
})

test('an interrupted reorder resumes the same position save without repeating completed updates', async ({ page }) => {
  const { writes } = await setupOrdering(page, { interrupt: true })
  await page.goto('/app/master-data')
  await page.getByRole('button', { name: 'Reorder Retail', exact: true }).dragTo(
    page.getByRole('table').locator('tbody tr').first().locator('td').nth(1),
  )
  await expect(page.getByRole('button', { name: 'Retry saving order' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Product categories', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Edit Education', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Reorder Education', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Retry saving order' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Order saved.' })).toBeVisible()
  expect(writes).toHaveLength(3)
  expect(writes[2]).toEqual(writes[1])
  expect(writes[2].key).not.toBe(writes[0].key)
  await page.reload()
  await expect(page.getByRole('table').locator('tbody .reference-entry-name strong')).toHaveText(['Retail', 'Education', 'Healthcare'])
})

test('keyboard ordering loads every page and filtered lists keep their handles disabled', async ({ page }) => {
  const { reads } = await setupOrdering(page, { count: 55 })
  await page.goto('/app/master-data')
  await page.getByRole('button', { name: 'Reorder Healthcare', exact: true }).press('ArrowUp')
  await expect(page.getByRole('status').filter({ hasText: 'Order saved.' })).toBeVisible()
  await expect(page.getByRole('table').locator('tbody .reference-entry-name strong').first()).toHaveText('Healthcare')
  await expect(page.getByRole('button', { name: 'Reorder Healthcare', exact: true })).toBeFocused()
  expect(reads.some(url => url.searchParams.get('limit') === '50' && url.searchParams.get('after') === '50')).toBe(true)
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Reorder Reference 26', exact: true }).press('ArrowUp')
  await expect(page.getByText('Page 1 · 25 entries shown', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('table').locator('tbody .reference-entry-name strong').first()).toHaveText('Reference 26')
  await page.getByRole('searchbox', { name: 'Search industries' }).fill('Health')
  await expect(page.getByRole('button', { name: 'Reorder Healthcare', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  await page.getByRole('button', { name: 'Status', exact: true }).click()
  await page.getByRole('option', { name: 'Archived', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Reorder Healthcare', exact: true })).toBeDisabled()
})

test('focused and invalid fields keep complete borders and aligned modal spacing', async ({ page }, testInfo) => {
  await setup(page)
  await page.goto('/app/master-data')
  await page.getByRole('tab', { name: 'Decoration locations', exact: true }).click()
  await page.getByRole('button', { name: 'Create decoration location', exact: true }).click()
  const dialog = page.getByRole('dialog')
  for (const dark of [false, true]) {
    await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark)
    await dialog.getByRole('button', { name: 'Create decoration location', exact: true }).click()
    const name = dialog.getByLabel('Name', { exact: true })
    await expect(name).toHaveAttribute('aria-invalid', 'true')
    await expect(name).toBeFocused()
    const layout = await name.evaluate(input => {
      const rect = input.getBoundingClientRect()
      const modal = input.closest('dialog')
      const body = modal.querySelector('.app-dialog-body').getBoundingClientRect()
      const heading = modal.querySelector('h2').getBoundingClientRect()
      return {
        left: rect.left - body.left,
        right: body.right - rect.right,
        alignment: Math.abs(heading.left - rect.left),
        outline: getComputedStyle(input).outlineStyle,
      }
    })
    expect(layout.left).toBeGreaterThanOrEqual(20)
    expect(layout.right).toBeGreaterThanOrEqual(20)
    expect(layout.alignment).toBeLessThan(1)
    expect(layout.outline).toBe('none')
    await page.screenshot({ path: testInfo.outputPath(`reference-focused-${dark ? 'dark' : 'light'}.png`) })
    await dialog.getByLabel('Description', { exact: true }).click()
    await expect(dialog.getByLabel('Description', { exact: true })).toBeFocused()
  }
})

test('a conflicting reorder stops and reloads the actual saved order', async ({ page }) => {
  const { writes } = await setupOrdering(page, { conflict: true })
  await page.goto('/app/master-data')
  await page.getByRole('button', { name: 'Reorder Retail', exact: true }).press('ArrowUp')
  await expect(page.getByRole('button', { name: 'Reload list', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retry saving order' })).toHaveCount(0)
  expect(writes).toHaveLength(2)
  await page.getByRole('button', { name: 'Reload list', exact: true }).click()
  await expect(page.getByRole('table').locator('tbody .reference-entry-name strong')).toHaveText(['Education', 'Healthcare', 'Retail'])
  await expect(page.getByRole('tab', { name: 'Product categories', exact: true })).toBeEnabled()
})

test('reference ordering stays valid at tied and maximum position boundaries', async ({ page }) => {
  await setup(page)
  await page.goto('/app/master-data')
  const failures = await page.evaluate(async () => {
    const { planReferenceMove } = await import('/src/services/referenceLists.js')
    const failures = []
    for (const ranks of [[0, 0, 0, 0], [0, 1, 2, 3], [10000, 10000, 10000], [0, 9999, 10000], [0, 100, 200, 300]]) {
      const items = ranks.map((sortOrder, index) => ({ id: String(index), label: String(index), revision: 3, sortOrder }))
      for (const from of items) for (const to of items) {
        const plan = planReferenceMove(items, from.id, to.id)
        const positions = new Map(plan.updates.map(item => [item.id, item.sortOrder]))
        const actual = items.map(item => ({ ...item, sortOrder: positions.get(item.id) ?? item.sortOrder }))
          .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
        if (actual.map(item => item.id).join() !== plan.items.map(item => item.id).join() ||
            plan.updates.some(item => !Number.isInteger(item.sortOrder) || item.sortOrder < 0 || item.sortOrder > 10000))
          failures.push({ ranks, from: from.id, to: to.id, plan, actual })
      }
    }
    return failures
  })
  expect(failures).toEqual([])
})

test.describe('touch reference ordering', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 1800 } })

  test('touch dragging saves the mobile card order', async ({ page }) => {
    await setupOrdering(page)
    await page.goto('/app/master-data')
    const source = await page.getByRole('button', { name: 'Reorder Retail', exact: true }).boundingBox()
    const target = await page.getByRole('table').locator('tbody tr').first().locator('td').nth(1).boundingBox()
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: source.x + source.width / 2, y: source.y + source.height / 2, id: 1 }] })
    await expect(page.locator('.reference-drag-preview strong')).toHaveText('Retail')
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: target.x + target.width / 2, y: target.y + target.height / 2, id: 1 }] })
    await expect(page.locator('.reference-drag-preview')).toContainText('Drop before Education')
    const preview = await page.locator('.reference-drag-preview').boundingBox()
    expect(preview.x).toBeGreaterThanOrEqual(0)
    expect(preview.x + preview.width).toBeLessThanOrEqual(390)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(page.locator('.reference-drag-preview')).toHaveCount(0)
    await expect(page.getByRole('status').filter({ hasText: 'Order saved.' })).toBeVisible()
    await expect(page.getByRole('table').locator('tbody .reference-entry-name strong')).toHaveText(['Retail', 'Education', 'Healthcare'])
    await cdp.detach()
  })
})
