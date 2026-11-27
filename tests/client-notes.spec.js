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
    else if (current.endsWith('/permissions')) data = { owner: true, grants: ['clients.view', 'clients.add', 'clients.edit', 'clients.view'].map(key => ({ key, scope: key === 'clients.add' ? 'none' : 'all' })) }
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
  await dialog.getByRole('button', { name: 'Dismiss error', exact: true }).click()
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

for (const mode of ['light', 'dark']) {
  for (const width of [375, 1440]) {
    test(`expanded formatting saves and renders in ${mode} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await page.addInitScript(theme => localStorage.setItem('theme', theme), mode)
      const { writes } = await setup(page, { notes: '<p>Project brief</p>' })
      await page.goto(`/app/clients/${clientId}/edit`)
      const form = page.locator('.client-edit-form')
      const editor = form.getByRole('textbox', { name: 'Notes', exact: true })
      await editor.press('ControlOrMeta+a')
      await form.getByRole('combobox', { name: 'Text style' }).selectOption('2')
      await form.getByRole('button', { name: 'Underline', exact: true }).click()
      await expect(editor.locator('h2 u')).toHaveText('Project brief')
      await expect(form.getByRole('button', { name: 'Underline', exact: true })).toHaveAttribute('aria-pressed', 'true')
      await expect(form.locator('.text-editor-footer')).toContainText('2 words')
      const tools = form.locator('.text-editor-toolbar')
      await tools.scrollIntoViewIfNeeded()
      const box = await tools.boundingBox()
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(width)
      for (const button of await tools.getByRole('button').all()) {
        const rect = await button.boundingBox()
        expect(rect.x).toBeGreaterThanOrEqual(box.x)
        expect(rect.x + rect.width).toBeLessThanOrEqual(box.x + box.width + 1)
      }
      await page.screenshot({ path: testInfo.outputPath('expanded-editor.png') })
      await form.getByRole('button', { name: 'Save', exact: true }).click()
      await expect(page).toHaveURL(`/app/clients/${clientId}`)
      await expect(page.locator('.rich-text h2 u')).toHaveText('Project brief')
      expect(writes[0].body.notes).toBe('<h2><u>Project brief</u></h2><p></p>')
    })
  }
}

test('links validate, preserve selection, edit, remove and insert without submitting the form', async ({ page }) => {
  const { writes } = await setup(page, { notes: '<p>Project brief</p>' })
  await page.goto(`/app/clients/${clientId}/edit`)
  const form = page.locator('.client-edit-form')
  const editor = form.getByRole('textbox', { name: 'Notes', exact: true })
  await editor.press('ControlOrMeta+a')
  await editor.press('ControlOrMeta+k')
  const url = form.getByRole('textbox', { name: 'Link URL', exact: true })
  await expect(url).toBeFocused()
  await url.fill('javascript:alert(1)')
  await url.press('Enter')
  await expect(form.getByRole('alert')).toContainText('Enter a full')
  await expect(editor.locator('a')).toHaveCount(0)
  expect(writes).toHaveLength(0)
  await url.fill('https://example.com/brief')
  await url.press('Enter')
  await expect(editor.locator('a')).toHaveText('Project brief')
  await expect(editor.locator('a')).toHaveAttribute('href', 'https://example.com/brief')
  await expect(url).toHaveCount(0)
  await form.getByRole('button', { name: 'Edit link', exact: true }).click()
  await expect(url).toHaveValue('https://example.com/brief')
  await url.fill('mailto:team@example.com')
  await form.getByRole('button', { name: 'Apply link', exact: true }).click()
  await expect(editor.locator('a')).toHaveAttribute('href', 'mailto:team@example.com')
  await form.getByRole('button', { name: 'Remove link', exact: true }).click()
  await expect(editor.locator('a')).toHaveCount(0)
  await expect(editor).toHaveText('Project brief')
  await editor.press('ControlOrMeta+a')
  await editor.press('Backspace')
  await form.getByRole('button', { name: 'Insert link', exact: true }).click()
  await url.fill('https://example.com')
  await url.press('Escape')
  await expect(url).toHaveCount(0)
  await expect(editor).toBeFocused()
  await editor.press('ControlOrMeta+k')
  await url.fill('https://example.com')
  await form.getByRole('button', { name: 'Apply link', exact: true }).click()
  await expect(editor.locator('a')).toHaveText('https://example.com')
  expect(writes).toHaveLength(0)
  await form.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page).toHaveURL(`/app/clients/${clientId}`)
  await expect(page.locator('.rich-text a')).toHaveAttribute('href', 'https://example.com')
  await expect(page.locator('.rich-text a')).toHaveAttribute('rel', 'noopener noreferrer')
})

test('list nesting, block styles, dividers and cleanup preserve content', async ({ page }) => {
  await setup(page, { notes: '<p>First item</p><p>Second item</p>' })
  await page.goto(`/app/clients/${clientId}/edit`)
  const form = page.locator('.client-edit-form')
  const editor = form.getByRole('textbox', { name: 'Notes', exact: true })
  await editor.press('ControlOrMeta+a')
  await form.getByRole('button', { name: 'Bullet list', exact: true }).click()
  await editor.locator('li').filter({ hasText: 'Second item' }).click()
  await form.getByRole('button', { name: 'Indent list item', exact: true }).click()
  await expect(editor.locator('ul ul li')).toHaveText('Second item')
  await form.getByRole('button', { name: 'Outdent list item', exact: true }).click()
  await expect(editor.locator('ul ul')).toHaveCount(0)
  await editor.press('ControlOrMeta+a')
  await form.getByRole('button', { name: 'Clear formatting', exact: true }).click()
  await expect(editor.locator('ul')).toHaveCount(0)
  await form.getByRole('button', { name: 'Block quote', exact: true }).click()
  await expect(editor.locator('blockquote')).toContainText('First item')
  await form.getByRole('button', { name: 'Block quote', exact: true }).click()
  await form.getByRole('button', { name: 'Code block', exact: true }).click()
  await expect(editor.locator('pre code').first()).toContainText('First item')
  await form.getByRole('button', { name: 'Clear formatting', exact: true }).click()
  await expect(editor.locator('pre, blockquote')).toHaveCount(0)
  await editor.press('ControlOrMeta+End')
  await form.getByRole('button', { name: 'Insert divider', exact: true }).click()
  await expect(editor.locator('hr')).toHaveCount(1)
  await form.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page).toHaveURL(`/app/clients/${clientId}`)
  await expect(page.locator('.rich-text hr')).toHaveCount(1)
  await expect(page.locator('.rich-text')).toContainText('Second item')
})

test('oversized typing, paste and formatting keep valid content and undo history', async ({ page }) => {
  await setup(page, { notes: '<p>Brief</p>' })
  await page.goto(`/app/clients/${clientId}/edit`)
  const form = page.locator('.client-edit-form')
  const editor = form.getByRole('textbox', { name: 'Notes', exact: true })
  await editor.fill('x'.repeat(1993))
  await expect(form.locator('.text-editor-counter')).toContainText('2000 / 2000')
  await editor.press('ControlOrMeta+End')
  await editor.press('y')
  await expect(editor).toHaveText('x'.repeat(1993))
  await expect(form.locator('.text-editor-limit')).toContainText('exceeds the 2000 character limit')
  await editor.press('ControlOrMeta+a')
  await form.getByRole('button', { name: 'Bold', exact: true }).click()
  await expect(editor.locator('strong')).toHaveCount(0)
  await expect(editor).toHaveText('x'.repeat(1993))
  await editor.evaluate(node => {
    const clipboardData = new DataTransfer()
    clipboardData.setData('text/plain', 'z'.repeat(2500))
    node.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }))
  })
  await expect(editor).toHaveText('x'.repeat(1993))
  await form.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(editor).toHaveText('Brief')
  await form.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect(editor).toHaveText('x'.repeat(1993))
  await editor.press('ControlOrMeta+End')
  await editor.press('Backspace')
  await expect(form.locator('.text-editor-limit')).toHaveText('')
  await expect(form.locator('.text-editor-counter')).toContainText('1999 / 2000')
})

test('new formatting reloads safely and selection updates active toolbar state', async ({ page }) => {
  await setup(page, { notes: '<h3>Brief</h3><blockquote><p><u>Quoted</u></p></blockquote><pre><code>&lt;sample&gt;</code></pre><hr><p>Plain</p>' })
  await page.goto(`/app/clients/${clientId}/edit`)
  const form = page.locator('.client-edit-form')
  const editor = form.getByRole('textbox', { name: 'Notes', exact: true })
  await editor.locator('u').click()
  await expect(form.getByRole('button', { name: 'Underline', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(form.getByRole('button', { name: 'Block quote', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await editor.locator('p').filter({ hasText: 'Plain' }).click()
  await expect(form.getByRole('button', { name: 'Underline', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await expect(form.getByRole('button', { name: 'Block quote', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await page.goto(`/app/clients/${clientId}`)
  await expect(page.locator('.rich-text h3')).toHaveText('Brief')
  await expect(page.locator('.rich-text blockquote u')).toHaveText('Quoted')
  await expect(page.locator('.rich-text pre code')).toHaveText('<sample>')
  await expect(page.locator('.rich-text hr')).toHaveCount(1)
})
