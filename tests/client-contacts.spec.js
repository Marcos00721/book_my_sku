import { expect, test } from '@playwright/test'
import { mockSignedIn } from './helpers/auth'

const org = '507f1f77bcf86cd799439011'
const clientId = '507f1f77bcf86cd799439021'
const base = `/organizations/${org}/clients/${clientId}`
const path = `${base}/contacts`
const firstId = '507f1f77bcf86cd799439031'
const otherId = '507f1f77bcf86cd799439033'

async function setup(page, { editable = true, archived = false, view = true } = {}) {
  await mockSignedIn(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('https://fonts.googleapis.com/**', route => route.abort())
  await page.route('https://fonts.gstatic.com/**', route => route.abort())
  const writes = []
  const queries = []
  const reads = []
  const contacts = [
    { _id: firstId, name: 'Alex Smith', jobTitle: 'Purchasing manager', email: 'alex@example.com', phone: '555-123-4567', active: true, __v: 7 },
    { _id: '507f1f77bcf86cd799439032', name: 'Jordan Lee', jobTitle: 'Accounts payable', email: 'jordan@example.com', active: true, __v: 2 },
    { _id: otherId, name: 'Robin Patel', jobTitle: 'Director', email: 'robin@example.com', active: true, __v: 3 },
  ]
  const defaults = { primaryContactId: otherId, billingContactId: null, clientVersion: 4 }
  await page.route('**/api/v1/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const current = url.pathname.replace('/api/v1', '')
    const method = request.method()
    let data = { items: [], next: null }
    if (method === 'GET') reads.push(current)
    else writes.push({ path: current, method, body: request.postDataJSON() })
    if (current === '/organizations') data = { items: [{ id: org, name: 'QA Studio', status: 'active' }] }
    else if (current.endsWith('/permissions')) data = { owner: false, grants: ['clients.view', ...(view ? ['contacts.view'] : []), ...(editable ? ['contacts.add', 'contacts.edit', 'contacts.delete', 'clients.edit'] : [])].map(key => ({ key, scope: key.endsWith('.add') ? 'none' : 'all' })) }
    else if (current.endsWith('/access')) data = { writesAllowed: true, state: 'normal' }
    else if (current === base) data = { _id: clientId, name: 'Acme Promotions', clientCode: 'CLI-001', status: archived ? 'archived' : 'active', __v: 4 }
    else if (current === `${base}/management`) data = { relationshipStatus: 'customer' }
    else if (current === `${path}/defaults`) {
      if (method === 'PATCH') {
        const body = request.postDataJSON()
        for (const key of ['primary', 'billing']) if (Object.hasOwn(body, key)) defaults[`${key}ContactId`] = body[key]?.contactId || null
        defaults.clientVersion++
      }
      data = { ...defaults }
    } else if (current === `${path}/duplicate-candidates`) data = { items: url.searchParams.get('email') === 'alex@example.com' ? [contacts[0]] : [] }
    else if (current === path && method === 'POST') {
      data = { _id: 'created-contact', ...request.postDataJSON(), active: true, __v: 0 }
      contacts.unshift(data)
    } else if (current === path) {
      const query = Object.fromEntries(url.searchParams)
      queries.push(query)
      const filtered = contacts.filter(contact => (query.state === 'all' || (query.state === 'inactive' ? !contact.active : contact.active)) && (!query.search || contact.name.startsWith(query.search)))
      data = { items: query.after ? filtered.slice(2) : filtered.slice(0, 2), next: !query.after && filtered.length > 2 ? 'second-page' : null }
    } else if (current.startsWith(`${path}/`)) {
      const parts = current.slice(path.length + 1).split('/')
      const contact = contacts.find(item => item._id === parts[0])
      if (method === 'PATCH') Object.assign(contact, request.postDataJSON(), { __v: contact.__v + 1 })
      if (method === 'POST') {
        contact.active = parts[1] === 'restore'
        contact.__v++
        if (!contact.active) for (const key of ['primaryContactId', 'billingContactId']) if (defaults[key] === contact._id) defaults[key] = null
        defaults.clientVersion++
      }
      data = { ...contact }
    }
    await route.fulfill({ json: { data } })
  })
  await page.goto(`/app/clients/${clientId}`)
  if (view) await page.getByRole('tab', { name: 'Contacts', exact: true }).click()
  return { writes, queries, reads, contacts }
}

for (const width of [320, 1440]) {
  test(`client contacts use compact layouts and preserve create, edit and default flows at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 })
    const { writes } = await setup(page)
    const panel = page.getByRole('tabpanel', { name: 'Contacts', exact: true })
    await expect(panel.getByRole('button', { name: 'Change primary contact' })).toContainText('Robin Patel')
    await expect(panel).not.toContainText(otherId)
    await expect(panel.getByRole('link', { name: 'alex@example.com' })).toHaveAttribute('href', 'mailto:alex@example.com')
    await page.screenshot({ path: testInfo.outputPath(`contacts-${width}.png`), fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

    await panel.getByRole('button', { name: 'Add contact', exact: true }).click()
    const add = page.getByRole('dialog', { name: 'Add contact', exact: true })
    await expect(add.getByRole('textbox', { name: 'Full name' })).toBeFocused()
    await expect(add.getByRole('alert')).toHaveCount(0)
    await expect(add.getByText('Person details')).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath(`add-contact-${width}.png`) })
    const box = await add.boundingBox()
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(width)
    expect(await add.locator('.dialog-footer > button').evaluateAll(items => new Set(items.map(item => item.getBoundingClientRect().y)).size)).toBe(1)
    await add.getByRole('button', { name: 'Add contact', exact: true }).click()
    await expect(add.getByRole('alert')).toHaveText('Name is required')
    await add.getByRole('textbox', { name: 'Full name' }).fill('Draft')
    await add.getByRole('textbox', { name: 'Email address' }).fill('alex@example.com')
    await expect(add.getByRole('complementary', { name: 'Possible duplicates' })).toContainText('Alex Smith')
    await add.getByRole('button', { name: 'Clear', exact: true }).click()
    await expect(add.getByRole('textbox', { name: 'Full name' })).toHaveValue('')
    await expect(add.getByRole('complementary')).toHaveCount(0)
    await add.getByRole('textbox', { name: 'Full name' }).fill('Casey Brown')
    await add.getByRole('textbox', { name: 'Email address' }).fill('casey@example.com')
    await add.getByRole('textbox', { name: 'Phone', exact: true }).fill('5559876543')
    await add.getByRole('button', { name: 'Add contact', exact: true }).click()
    await expect(add).toHaveCount(0)
    expect(writes[0].body).toEqual({ name: 'Casey Brown', email: 'casey@example.com', phone: '555-987-6543', jobTitle: null })
    await expect(panel.getByRole('button', { name: 'Edit Casey Brown' })).toBeVisible()

    await panel.getByRole('button', { name: 'Edit Alex Smith' }).click()
    const edit = page.getByRole('dialog', { name: 'Edit contact' })
    await edit.getByRole('textbox', { name: 'Email address' }).fill('')
    await edit.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(edit).toHaveCount(0)
    expect(writes[1].body).toEqual({ name: 'Alex Smith', email: null, phone: '555-123-4567', jobTitle: 'Purchasing manager', expectedVersion: 7 })

    await panel.getByRole('button', { name: 'Change billing contact' }).click()
    const picker = page.getByRole('dialog', { name: 'Billing contact', exact: true })
    await picker.getByRole('searchbox', { name: 'Find contact' }).fill('Robin')
    await picker.getByRole('button', { name: 'Search contacts', exact: true }).click()
    await picker.getByRole('button', { name: /Robin Patel/ }).click()
    await expect(picker).toHaveCount(0)
    expect(writes[2].body).toEqual({ expectedClientVersion: 4, billing: { contactId: otherId, expectedVersion: 3 } })
    await expect(panel.getByRole('button', { name: 'Change billing contact' })).toContainText('Robin Patel')
    await panel.getByRole('button', { name: 'Change billing contact' }).click()
    await page.getByRole('dialog', { name: 'Billing contact' }).getByRole('button', { name: 'Clear billing contact' }).click()
    expect(writes[3].body).toEqual({ expectedClientVersion: 5, billing: null })
    await expect(panel.getByRole('button', { name: 'Change billing contact' })).toContainText('Not set')
  })
}

for (const editing of [false, true]) {
  test(`contact ${editing ? 'editing' : 'creation'} waits for explicit save while entering email and phone`, async ({ page }) => {
    const { writes } = await setup(page)
    await page.getByRole('button', { name: editing ? 'Edit Alex Smith' : 'Add contact', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: editing ? 'Edit contact' : 'Add contact', exact: true })
    await dialog.getByRole('textbox', { name: 'Full name' }).fill('Casey Brown')
    await dialog.getByRole('textbox', { name: 'Job title' }).fill('Buyer')
    const email = dialog.getByRole('textbox', { name: 'Email address' })
    await Promise.all([
      page.waitForResponse(response => new URL(response.url()).pathname.endsWith(`${path}/duplicate-candidates`) && response.request().method() === 'GET'),
      email.fill('casey@example.com'),
    ])
    await email.press('Tab')
    const phone = dialog.getByRole('textbox', { name: 'Phone', exact: true })
    await expect(phone).toBeFocused()
    await phone.fill('')
    await phone.pressSequentially('5559876543')
    await phone.press('Tab')
    await expect(dialog).toBeVisible()
    expect(writes).toHaveLength(0)

    for (const name of ['Full name', 'Job title', 'Email address', 'Phone']) {
      await dialog.getByRole('textbox', { name, exact: true }).press('Enter')
      await expect(dialog).toBeVisible()
      expect(writes).toHaveLength(0)
    }

    const save = dialog.getByRole('button', { name: editing ? 'Save' : 'Add contact', exact: true })
    if (editing) {
      await save.focus()
      await save.press('Enter')
    } else await save.click()
    await expect(dialog).toHaveCount(0)
    expect(writes).toEqual([{
      path: editing ? `${path}/${firstId}` : path,
      method: editing ? 'PATCH' : 'POST',
      body: { name: 'Casey Brown', jobTitle: 'Buyer', email: 'casey@example.com', phone: '555-987-6543', ...(editing ? { expectedVersion: 7 } : {}) },
    }])
  })
}

test('contact search and filters reset cursors; archive and restore use the saved revision', async ({ page }) => {
  const { queries, writes } = await setup(page)
  const panel = page.getByRole('tabpanel', { name: 'Contacts' })
  await panel.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(panel.getByText('Robin Patel', { exact: true }).last()).toBeVisible()
  expect(queries.at(-1).after).toBe('second-page')
  await panel.getByRole('searchbox', { name: 'Search contacts' }).fill('Alex')
  await panel.getByRole('button', { name: 'Search contacts', exact: true }).click()
  await expect(panel.getByRole('button', { name: 'Archive Alex Smith' })).toBeVisible()
  expect(queries.at(-1)).toMatchObject({ search: 'Alex', state: 'active' })
  expect(queries.at(-1).after).toBeUndefined()
  await panel.getByRole('button', { name: 'Archive Alex Smith' }).click()
  await page.getByRole('dialog', { name: 'Archive contact?' }).getByRole('button', { name: 'Archive', exact: true }).click()
  await expect(panel.getByRole('heading', { name: 'No matching contacts' })).toBeVisible()
  expect(writes[0]).toEqual({ path: `${path}/${firstId}/archive`, method: 'POST', body: { expectedVersion: 7 } })
  await panel.getByRole('button', { name: 'Status', exact: true }).click()
  await page.getByRole('option', { name: 'Archived', exact: true }).click()
  await panel.getByRole('button', { name: 'Restore Alex Smith' }).click()
  await page.getByRole('dialog', { name: 'Restore contact?' }).getByRole('button', { name: 'Restore', exact: true }).click()
  await expect(panel.getByRole('heading', { name: 'No matching contacts' })).toBeVisible()
  expect(writes[1].body).toEqual({ expectedVersion: 8 })
  expect(queries.at(-1).state).toBe('inactive')
  expect(queries.at(-1).after).toBeUndefined()
})

for (const options of [{ editable: false }, { archived: true }]) {
  test(`contacts stay read-only with ${JSON.stringify(options)}`, async ({ page }) => {
    await setup(page, options)
    const panel = page.getByRole('tabpanel', { name: 'Contacts' })
    await expect(panel.getByText('Alex Smith', { exact: true })).toBeVisible()
    await expect(panel.getByRole('button', { name: /Add contact|Edit Alex|Archive Alex|Change primary/ })).toHaveCount(0)
    await expect(panel.getByText('Robin Patel', { exact: true })).toBeVisible()
  })
}

test('contacts cannot be read without permission', async ({ page }) => {
  const { reads } = await setup(page, { view: false, editable: false })
  await expect(page.getByRole('heading', { name: 'Acme Promotions', exact: true })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Contacts', exact: true })).toHaveCount(0)
  expect(reads.filter(current => current.startsWith(path))).toHaveLength(0)
})

test('an uncertain default change can be retried from inside the picker', async ({ page }) => {
  await setup(page)
  const attempts = []
  await page.route(`**${path}/defaults`, async route => {
    const request = route.request()
    if (request.method() !== 'PATCH') return route.fallback()
    attempts.push({ body: request.postDataJSON(), key: request.headers()['idempotency-key'] })
    if (attempts.length === 1) return route.fulfill({ status: 500, json: { error: { code: 'TEMPORARY_ERROR', message: 'Please retry.' } } })
    return route.fallback()
  })
  await page.getByRole('button', { name: 'Change billing contact' }).click()
  const picker = page.getByRole('dialog', { name: 'Billing contact' })
  await picker.getByRole('button', { name: /Alex Smith/ }).click()
  await expect(picker.getByRole('alert')).toContainText('TEMPORARY_ERROR')
  await expect(picker.getByRole('button', { name: 'Close dialog' })).toBeDisabled()
  await picker.getByRole('button', { name: 'Retry last action' }).click()
  await expect(picker).toHaveCount(0)
  expect(attempts).toHaveLength(2)
  expect(attempts[0].key).toBeTruthy()
  expect(attempts[1]).toEqual(attempts[0])
  await expect(page.getByRole('button', { name: 'Change billing contact' })).toContainText('Alex Smith')
})
