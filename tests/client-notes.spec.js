import { expect, test } from '@playwright/test'
import { mockSignedIn } from './helpers/auth'

const org = '507f1f77bcf86cd799439011'
const clientId = '507f1f77bcf86cd799439021'
const path = `/organizations/${org}/clients/${clientId}`

async function setup(page) {
  await mockSignedIn(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('https://fonts.googleapis.com/**', route => route.abort())
  await page.route('https://fonts.gstatic.com/**', route => route.abort())
  const writes = []
  const notes = [
    { id: 'rich', text: '<p><strong>Project brief</strong> with <em>details</em></p><ul><li>First step</li></ul>' },
    { id: 'legacy', text: 'Legacy first line\nSecond line & details' },
    { id: 'unsafe', text: '<p onclick="window.noteAttack = true">Safe content</p><script>window.noteAttack = true</script><img src=x onerror="window.noteAttack = true"><a href="javascript:window.noteAttack=true">Unsafe link</a>' },
  ].map(note => ({ ...note, revision: 1, createdAt: '2026-11-16T10:00:00Z', actor: { label: 'Alex' } }))
  await page.route('**/api/v1/**', async route => {
    const request = route.request()
    const current = new URL(request.url()).pathname.replace('/api/v1', '')
    let data = { items: [], next: null }
    if (current === '/organizations') data = { items: [{ id: org, name: 'QA Studio', status: 'active' }], next: null }
    else if (current.endsWith('/permissions')) data = { owner: true, grants: ['clients.view', 'clients.edit', 'clients.history.view'].map(key => ({ key, scope: 'all' })) }
    else if (current.endsWith('/access')) data = { state: 'normal', writesAllowed: true }
    else if (current === path) data = { _id: clientId, name: 'QA Client', status: 'active', __v: 1 }
    else if (current === `${path}/management`) data = { relationshipStatus: 'customer', clientVersion: 1 }
    else if (current === `${path}/activity`) data = { items: [{
      id: 'note-event', action: 'note.corrected', entity: { type: 'note' },
      occurredAt: '2026-11-16T10:00:00Z',
      changes: [{ field: 'text', before: '<p><em>Old briefing</em></p>', after: '<p><strong>New briefing</strong></p>' }],
    }], next: null }
    else if (current === `${path}/notes` && request.method() === 'POST') {
      writes.push({ method: 'POST', body: request.postDataJSON() })
      data = { id: 'created', revision: 1, createdAt: '2026-11-16T10:00:00Z', ...request.postDataJSON() }
      notes.unshift(data)
    } else if (current === `${path}/notes`) data = { items: notes, next: null }
    else if (current === `${path}/notes/legacy` && request.method() === 'PATCH') {
      const body = request.postDataJSON()
      writes.push({ method: 'PATCH', body })
      Object.assign(notes.find(note => note.id === 'legacy'), { text: body.text, revision: 2 })
      data = notes.find(note => note.id === 'legacy')
    } else if (current.endsWith('/versions')) data = { items: [{ id: 'version', revision: 1, text: notes.find(note => note.id === 'rich').text }], next: null }
    await route.fulfill({ json: { data } })
  })
  return writes
}

for (const width of [375, 1440]) {
  test(`client notes edit and display rich text safely at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const writes = await setup(page)
    await page.goto(`/app/clients/${clientId}`)
    const notes = page.getByRole('tabpanel', { name: 'Overview' }).locator('section.panel').filter({ has: page.getByRole('heading', { name: 'Notes', exact: true }) })
    const rich = notes.locator('.note-card').filter({ hasText: 'Project brief' })
    await expect(rich.locator('strong')).toHaveText('Project brief')
    await expect(rich.locator('em')).toHaveText('details')
    await expect(rich.locator('li')).toHaveText('First step')
    const legacy = notes.locator('.note-card').filter({ hasText: 'Legacy first line' })
    await expect(legacy.locator('.rich-text')).toHaveText('Legacy first line\nSecond line & details')
    const unsafe = notes.locator('.note-card').filter({ hasText: 'Safe content' })
    await expect(unsafe.locator('img, script, [onclick], a[href]')).toHaveCount(0)
    await expect(unsafe).not.toContainText('<p')
    await expect.poll(() => page.evaluate(() => window.noteAttack)).toBeUndefined()

    await rich.getByRole('button', { name: 'Version history' }).click()
    const history = page.getByRole('dialog', { name: 'Note versions' })
    await expect(history.locator('strong')).toHaveText('Project brief')
    await expect(history.locator('li')).toHaveText('First step')
    await history.getByRole('button', { name: 'Close dialog' }).click()

    await legacy.getByRole('button', { name: 'Edit', exact: true }).click()
    const edit = page.getByRole('dialog', { name: 'Edit note' })
    const legacyEditor = edit.locator('[contenteditable="true"]')
    await expect(legacyEditor).toContainText('Legacy first line')
    await expect(legacyEditor.locator('br')).toHaveCount(1)
    await edit.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(edit.getByRole('alert')).toHaveText('Correction reason is required')
    await edit.getByRole('textbox', { name: 'Correction reason' }).fill('Clarified briefing')
    await edit.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(edit).toHaveCount(0)
    expect(writes[0]).toEqual({ method: 'PATCH', body: { text: '<p>Legacy first line<br>Second line &amp; details</p>', expectedVersion: 1, reason: 'Clarified briefing' } })

    await notes.getByRole('button', { name: 'Create', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Add note' })
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(dialog.getByRole('alert')).toHaveText('Note is required')
    const editor = dialog.locator('[contenteditable="true"]')
    await editor.fill('New briefing')
    await editor.press('ControlOrMeta+a')
    await dialog.getByRole('button', { name: 'Bold', exact: true }).click()
    await expect(editor.locator('strong')).toHaveText('New briefing')
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    expect(writes[1]).toEqual({ method: 'POST', body: { text: '<p><strong>New briefing</strong></p>' } })
    await expect(notes.locator('.note-card').filter({ hasText: 'New briefing' }).locator('strong')).toHaveText('New briefing')

    await page.getByRole('tab', { name: 'Activity', exact: true }).click()
    const activity = page.getByRole('tabpanel', { name: 'Activity' })
    await expect(activity.locator('.activity-timeline-value-before em')).toHaveText('Old briefing')
    await expect(activity.locator('.activity-timeline-value-after strong')).toHaveText('New briefing')
    await expect(activity).not.toContainText('<p>')
  })
}
