import { expect, test } from '@playwright/test'
import { mockSignedIn } from './helpers/auth'

const org = '507f1f77bcf86cd799439011'
const clientId = '507f1f77bcf86cd799439021'
const root = `/organizations/${org}/clients`
const path = `${root}/${clientId}`

async function setup(page, { notes = '<p><strong>Project brief</strong> with <em>details</em></p>', failFirstWrite = false } = {}) {
  await mockSignedIn(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('https://fonts.googleapis.com/**', route => route.abort())
  await page.route('https://fonts.gstatic.com/**', route => route.abort())
  const writes = []
  const notesRequests = []
  const client = { _id: clientId, name: 'QA Client', notes, status: 'active', __v: 1 }
  let failed = false
  await page.route('**/api/v1/**', async route => {
    const request = route.request()
    const current = new URL(request.url()).pathname.replace('/api/v1', '')
    let data = { items: [], next: null }
    if (current.includes('/notes')) notesRequests.push(current)
    if (current === '/organizations') data = { items: [{ id: org, name: 'QA Studio', status: 'active' }], next: null }
    else if (current.endsWith('/permissions')) data = { owner: true, grants: ['clients.view', 'clients.create', 'clients.edit', 'clients.history.view'].map(key => ({ key, scope: key === 'clients.create' ? 'none' : 'all' })) }
    else if (current.endsWith('/access')) data = { state: 'normal', writesAllowed: true }
    else if ((current === root && request.method() === 'POST') || (current === path && request.method() === 'PATCH')) {
      const body = request.postDataJSON()
      writes.push({ method: request.method(), path: current, body, key: request.headers()['idempotency-key'] })
      if (failFirstWrite && !failed) {
        failed = true
        return route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE', message: 'Please retry saving the client.' } } })
      }
      Object.assign(client, body, { __v: request.method() === 'POST' ? 0 : client.__v + 1 })
      data = client
    } else if (current === path) data = client
    else if (current === `${path}/management`) data = { relationshipStatus: 'customer', clientVersion: client.__v }
    await route.fulfill({ json: { data } })
  })
  return { writes, notesRequests }
}

for (const width of [375, 1440]) {
  test(`client add and edit save rich notes through the client API at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const { writes, notesRequests } = await setup(page)
    await page.goto('/app/clients')
    await page.locator('.page-heading').getByRole('button', { name: 'Create', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Add client' })
    await dialog.getByRole('textbox', { name: 'Client name', exact: true }).fill('New client')
    const editor = dialog.locator('[contenteditable="true"]')
    await editor.fill('Initial briefing')
    await editor.press('ControlOrMeta+a')
    await dialog.getByRole('button', { name: 'Bold', exact: true }).click()
    await dialog.getByRole('button', { name: 'Add client', exact: true }).click()
    await expect(page).toHaveURL(`/app/clients/${clientId}`)
    const notes = page.locator('section.panel').filter({ has: page.getByRole('heading', { name: 'Notes', exact: true }) }).last()
    await expect(notes.locator('strong')).toHaveText('Initial briefing')
    expect(writes[0].body).toEqual({ name: 'New client', notes: '<p><strong>Initial briefing</strong></p>' })

    await notes.getByRole('link', { name: 'Edit notes' }).click()
    const form = page.locator('.client-edit-form')
    const edit = form.locator('[contenteditable="true"]')
    await expect(edit.locator('strong')).toHaveText('Initial briefing')
    await edit.fill('Updated briefing')
    await edit.press('ControlOrMeta+a')
    await form.getByRole('button', { name: 'Italic', exact: true }).click()
    await form.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page).toHaveURL(`/app/clients/${clientId}`)
    await expect(notes.locator('em')).toHaveText('Updated briefing')
    expect(writes[1].body).toEqual({ notes: '<p><strong><em>Updated briefing</em></strong></p>', expectedVersion: 0 })
    expect(writes).toHaveLength(2)
    expect(notesRequests).toEqual([])

    await notes.getByRole('link', { name: 'Edit notes' }).click()
    await page.locator('.client-edit-form [contenteditable="true"]').fill('')
    await page.locator('.client-edit-form').getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page).toHaveURL(`/app/clients/${clientId}`)
    expect(writes[2].body).toEqual({ notes: null, expectedVersion: 1 })
    await expect(notes).toContainText('No notes yet.')
    expect(notesRequests).toEqual([])
  })
}

test('uncertain create retries the same client and notes body and operation key', async ({ page }) => {
  const { writes, notesRequests } = await setup(page, { failFirstWrite: true })
  await page.goto('/app/clients')
  await page.locator('.page-heading').getByRole('button', { name: 'Create', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add client' })
  await dialog.getByRole('textbox', { name: 'Client name', exact: true }).fill('New client')
  await dialog.locator('[contenteditable="true"]').fill('Initial briefing')
  await dialog.getByRole('button', { name: 'Add client', exact: true }).click()
  await dialog.getByRole('button', { name: 'Retry same request' }).click()
  await expect(page).toHaveURL(`/app/clients/${clientId}`)
  expect(writes).toHaveLength(2)
  expect(writes[1]).toEqual(writes[0])
  expect(notesRequests).toEqual([])
})

test('legacy profile text preserves line breaks and unrelated edits omit notes', async ({ page }) => {
  const { writes, notesRequests } = await setup(page, { notes: 'First line\nSecond line & details' })
  await page.goto(`/app/clients/${clientId}/edit`)
  const form = page.locator('.client-edit-form')
  await expect(form.locator('[contenteditable="true"] br')).toHaveCount(1)
  await form.getByRole('textbox', { name: 'Account label', exact: true }).fill('West campus')
  await form.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page).toHaveURL(`/app/clients/${clientId}`)
  expect(writes[0].body).toEqual({ accountLabel: 'West campus', expectedVersion: 1 })
  expect(notesRequests).toEqual([])
})

test('profile notes render supported formatting without executing stored HTML', async ({ page }) => {
  const { notesRequests } = await setup(page, { notes: '<p onclick="window.noteAttack = true"><strong>Safe content</strong></p><script>window.noteAttack = true</script><img src=x onerror="window.noteAttack = true"><a href="javascript:window.noteAttack=true">Unsafe link</a>' })
  await page.goto(`/app/clients/${clientId}`)
  const notes = page.locator('section.panel').filter({ has: page.getByRole('heading', { name: 'Notes', exact: true }) }).last()
  await expect(notes.locator('strong')).toHaveText('Safe content')
  await expect(notes.locator('img, script, [onclick], a[href^="javascript:"]')).toHaveCount(0)
  expect(await page.evaluate(() => window.noteAttack)).toBeUndefined()
  expect(notesRequests).toEqual([])
})
