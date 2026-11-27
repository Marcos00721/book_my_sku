import { expect, test } from '@playwright/test'
import { authUrl, makeSession, mockSignedIn } from './helpers/auth'

const org = '507f1f77bcf86cd799439011'
const otherOrg = '507f1f77bcf86cd799439012'
const id = '507f1f77bcf86cd799439022'
const member = '507f1f77bcf86cd799439099'
const clientId = '507f1f77bcf86cd799439033'
const contactId = '507f1f77bcf86cd799439044'
const base = `/api/v1/organizations/${org}`
const path = `${base}/inquiries/${id}`
const grants = ['inquiries.view', 'inquiries.add', 'inquiries.edit', 'projects.view', 'projects.add', 'projects.edit', 'clients.view', 'clients.add', 'contacts.view', 'contacts.add']
const sample = {
  _id: id, revision: 2, stage: 'reviewing', source: 'manual', ownerId: member,
  submitted: { companyName: 'Original company', contactName: 'Alex Smith', email: 'alex@example.com', phone: '+91 9876543210', requirement: '<p>100 <strong>branded shirts</strong></p>', requestedInHandsDate: '2026-12-10' },
  corrections: { companyName: 'Acme Studio' }, createdAt: '2026-11-20T12:00:00.000Z',
}

async function setup(page, options = {}) {
  const state = { lead: structuredClone({ ...sample, ...options.lead }), requests: [], writes: [], form: { enabled: false, revision: 3, owner: { id: member, label: 'Alex Smith', eligible: true }, linkState: 'available', url: 'https://example.com/inquiry-forms/private-test-token', publicIntakeAvailable: false } }
  if (!options.signedOut) await mockSignedIn(page)
  await page.route('https://fonts.googleapis.com/**', route => route.abort())
  await page.route('https://fonts.gstatic.com/**', route => route.abort())
  await page.route('**/api/v1/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    const reply = data => route.fulfill({ json: { data } })
    state.requests.push({ url, method })
    if (url.pathname === '/api/v1/organizations') return reply({ items: options.organizations || [{ id: org, name: 'Acme workspace', status: 'active' }], next: options.organizationNext || null })
    if (url.pathname.endsWith('/permissions')) return reply({ owner: options.owner || false, grants: (options.grants || grants).map(key => ({ key, scope: key.endsWith('.add') ? 'none' : 'all' })) })
    if (url.pathname.endsWith('/access')) return reply({ writesAllowed: options.writesAllowed !== false, state: options.writesAllowed === false ? 'restricted' : 'normal' })
    if (method !== 'GET') {
      state.writes.push({ method, path: url.pathname, body: request.postDataJSON(), key: request.headers()['idempotency-key'] })
      if (options.mutate && await options.mutate({ state, route, url, reply })) return
    }
    if (url.pathname === `${base}/assignment-options`) return reply({ items: [{ actorId: member, label: 'Alex Smith' }, { actorId: '507f1f77bcf86cd799439098', label: 'Sam Taylor' }], clientRepSuggestion: member })
    if (url.pathname === `${base}/clients` && method === 'GET') return reply({ items: [{ _id: clientId, name: 'Acme Client', clientCode: 'CL-000001', status: 'active' }], next: null })
    if (url.pathname === `${base}/clients` && method === 'POST') return reply({ _id: clientId, name: request.postDataJSON().name, status: 'active' })
    if (url.pathname === `${base}/clients/${clientId}`) return reply({ _id: clientId, name: 'Acme Client', status: 'active' })
    if (url.pathname === `${base}/clients/${clientId}/contacts`) return reply({ items: [{ _id: contactId, name: 'Chris Jones', active: true }], next: null })
    if (url.pathname === `${base}/clients/${clientId}/contacts/${contactId}`) return reply({ _id: contactId, name: 'Chris Jones', active: true })
    if (url.pathname === `${base}/inquiries` && method === 'GET') return reply({ items: [state.lead], next: null })
    if (url.pathname === `${base}/inquiries` && method === 'POST') {
      state.lead = { ...state.lead, submitted: request.postDataJSON(), corrections: {}, stage: 'new', revision: 0 }
      return reply({ type: 'inquiry', targetId: id, revision: 0 })
    }
    if (url.pathname === path && method === 'GET') return reply(state.lead)
    if (url.pathname === path && method === 'PATCH') {
      const body = request.postDataJSON()
      expect(body.expectedRevision).toBe(state.lead.revision)
      state.lead = { ...state.lead, revision: state.lead.revision + 1, corrections: { ...state.lead.corrections, ...body.corrections },
        ...(Object.hasOwn(body, 'clientId') ? { clientId: body.clientId, contactId: body.contactId } : {}),
        ...(body.ownerId ? { ownerId: body.ownerId } : {}),
        ...(body.transition ? { stage: ({ review: 'reviewing', qualify: 'qualified', return: 'reviewing', close: 'closed' })[body.transition.action], closeReason: body.transition.reason } : {}) }
      return reply({ type: 'inquiry', targetId: id, revision: state.lead.revision })
    }
    if (url.pathname === `${path}/convert` && method === 'POST') {
      state.lead = { ...state.lead, stage: 'converted', revision: state.lead.revision + 1, projectId: '507f1f77bcf86cd799439055' }
      return reply({ type: 'project', targetId: state.lead.projectId, reference: 'PRJ-0123ABCD', revision: 0 })
    }
    if (url.pathname === `${base}/projects/PRJ-0123ABCD`) return reply({ name: 'Acme launch', reference: 'PRJ-0123ABCD', brief: sample.submitted.requirement, requestedInHandsDate: sample.submitted.requestedInHandsDate })
    if (url.pathname === `${path}/activity`) return options.activity ? options.activity({ url, reply }) : reply([{ _id: 'event-2', event: 'reviewed', targetRevision: 2, actorType: 'staff', actorId: member, changedFields: [], createdAt: sample.createdAt }])
    if (url.pathname === `${base}/inquiry-form` && method === 'GET') return reply(state.form)
    if (url.pathname.startsWith(`${base}/inquiry-form`) && method !== 'GET') { state.form.revision++; return reply({ resultRevision: state.form.revision }) }
    return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Record unavailable' } } })
  })
  return state
}

async function choose(page, label, value, root = page) {
  await root.getByRole('button', { name: label, exact: true }).click()
  await page.getByRole('option', { name: value, exact: true }).click()
}

test('list links to accepted details, preserves original submission, and renders safe requirement HTML', async ({ page }) => {
  await setup(page, { lead: { corrections: { companyName: 'Acme Studio', requirement: '<p>Accepted <strong>brief</strong><script>window.leadXss=1</script><a href="javascript:alert(1)">unsafe link</a></p>' } } })
  await page.goto('/app/leads')
  await page.getByRole('link', { name: 'Acme Studio', exact: true }).click()
  await expect(page).toHaveURL(`/app/leads/${id}`)
  await expect(page.getByRole('heading', { name: 'Acme Studio', exact: true })).toBeVisible()
  const overview = page.getByRole('tabpanel', { name: 'Overview' })
  await expect(overview.locator('strong')).toContainText(['brief'])
  expect(await page.evaluate(() => window.leadXss)).toBeUndefined()
  await expect(overview.locator('a[href^="javascript:"]')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Original submission' }).click()
  await expect(page.getByRole('tabpanel')).toContainText('Original company')
  await expect(page.getByRole('tabpanel')).toContainText('100 branded shirts')
})

test('combined save sends only changed captures, explicit owner/client/contact, and qualification', async ({ page }) => {
  const state = await setup(page)
  await page.goto(`/app/leads/${id}`)
  await page.getByRole('button', { name: 'Edit lead', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit lead' })
  await dialog.getByLabel('Company name', { exact: true }).fill('Acme Updated')
  await choose(page, 'Lead owner', 'Sam Taylor', dialog)
  await choose(page, 'Client', 'Acme Client · CL-000001', dialog)
  await choose(page, 'Client contact', 'Chris Jones', dialog)
  await choose(page, 'Stage change', 'Mark qualified', dialog)
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(state.writes).toHaveLength(1)
  expect(state.writes[0].body).toEqual({ expectedRevision: 2, corrections: { companyName: 'Acme Updated' }, ownerId: '507f1f77bcf86cd799439098', clientId, contactId, transition: { action: 'qualify' } })
  await expect(page.getByRole('heading', { name: 'Acme Updated' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Convert to project', exact: true })).toBeVisible()
})

for (const grant of ['inquiries.add']) {
test(`${grant} exposes capture and sends formatted requirements with optional client selection`, async ({ page }) => {
  const state = await setup(page, { grants: ['inquiries.view', grant, 'clients.view'] })
  await page.goto('/app/leads')
  await page.getByRole('button', { name: 'Add lead', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add lead' })
  await dialog.getByLabel('Company name', { exact: true }).fill('New company')
  await dialog.getByLabel('Contact name', { exact: true }).fill('Alex Smith')
  await dialog.getByLabel('Email address', { exact: true }).fill('alex@example.com')
  await dialog.getByLabel('Requirement', { exact: true }).fill('250 event bags')
  await dialog.locator('summary').click()
  await expect(dialog.getByRole('button', { name: 'Lead owner', exact: true })).toHaveCount(0)
  await choose(page, 'Client', 'Acme Client · CL-000001', dialog)
  await dialog.getByRole('button', { name: 'Add lead', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(state.writes[0].body).toEqual({ companyName: 'New company', contactName: 'Alex Smith', email: 'alex@example.com', requirement: '<p>250 event bags</p>', clientId })
})
}

test('lead phone formats typed and pasted input when adding', async ({ page }) => {
  const state = await setup(page)
  await page.goto('/app/leads')
  await page.getByRole('button', { name: 'Add lead', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add lead' })
  const phone = dialog.getByLabel('Phone', { exact: true })
  await phone.pressSequentially('4155550123')
  await expect(phone).toHaveValue('415-555-0123')
  await phone.fill('+1 (212) 555-0199')
  await expect(phone).toHaveValue('212-555-0199')
  await dialog.getByLabel('Company name', { exact: true }).fill('New company')
  await dialog.getByLabel('Contact name', { exact: true }).fill('Alex Smith')
  await dialog.getByLabel('Email address', { exact: true }).fill('alex@example.com')
  await dialog.getByLabel('Requirement', { exact: true }).fill('250 event bags')
  await dialog.getByRole('button', { name: 'Add lead', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(state.writes[0].body.phone).toBe('212-555-0199')
})

test('lead phone formats existing values without creating a correction and restores formatting on clear', async ({ page }) => {
  const state = await setup(page, { lead: { corrections: { companyName: 'Acme Studio', phone: '+1 (415) 555-0123' } } })
  await page.goto(`/app/leads/${id}`)
  await page.getByRole('button', { name: 'Edit lead', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit lead' })
  const phone = dialog.getByLabel('Phone', { exact: true })
  await expect(phone).toHaveValue('415-555-0123')
  await expect(dialog.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  await phone.fill('2125550199')
  await expect(phone).toHaveValue('212-555-0199')
  await dialog.getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(phone).toHaveValue('415-555-0123')
  await expect(dialog.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  await dialog.getByLabel('Company name', { exact: true }).fill('Acme Updated')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(dialog).toHaveCount(0)
  expect(state.writes[0].body).toEqual({ expectedRevision: 2, corrections: { companyName: 'Acme Updated' } })
  await page.getByRole('button', { name: 'Edit lead', exact: true }).click()
  await expect(phone).toHaveValue('415-555-0123')
  await phone.fill('2125550199')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(dialog).toHaveCount(0)
  expect(state.writes[1].body).toEqual({ expectedRevision: 3, corrections: { phone: '212-555-0199' } })
})

test('the Add lead button is hidden without Add permission', async ({ page }) => {
  await setup(page, { grants: ['inquiries.view'] })
  await page.goto('/app/leads')
  await expect(page.getByRole('heading', { name: 'Leads', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add lead', exact: true })).toHaveCount(0)
})

test('a correction raced by qualification returns first and then saves the preserved capture draft', async ({ page }) => {
  const state = await setup(page, { mutate: async ({ state, route, url }) => {
    if (url.pathname === path && state.writes.length === 1) {
      state.lead = { ...state.lead, revision: 3, stage: 'qualified' }
      await route.fulfill({ status: 409, json: { error: { code: 'INQUIRY_CONFLICT', message: 'Lead was qualified' } } })
      return true
    }
  } })
  await page.goto(`/app/leads/${id}`)
  await page.getByRole('button', { name: 'Edit lead', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit lead' })
  await dialog.getByLabel('Company name', { exact: true }).fill('Preserved company edit')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await dialog.getByRole('button', { name: 'Use latest revision and keep my edits' }).click()
  await choose(page, 'Stage change', 'Return to reviewing', dialog)
  await dialog.getByLabel('Reason', { exact: true }).fill('Correct captured details')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await dialog.getByRole('button', { name: 'Continue with captured edits' }).click()
  await expect(dialog.getByLabel('Company name', { exact: true })).toHaveValue('Preserved company edit')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(dialog).toHaveCount(0)
  expect(state.writes.map(item => item.body)).toEqual([
    { expectedRevision: 2, corrections: { companyName: 'Preserved company edit' } },
    { expectedRevision: 3, transition: { action: 'return', reason: 'Correct captured details' } },
    { expectedRevision: 4, corrections: { companyName: 'Preserved company edit' } },
  ])
})

test('close requires a reason and leaves a terminal lead without edit or convert actions', async ({ page }) => {
  const state = await setup(page)
  await page.goto(`/app/leads/${id}`)
  await page.getByRole('button', { name: 'Edit lead', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit lead' })
  await choose(page, 'Stage change', 'Close lead', dialog)
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  expect(state.writes).toHaveLength(0)
  await expect(dialog.getByLabel('Reason', { exact: true })).toHaveAttribute('aria-invalid', 'true')
  await dialog.getByLabel('Reason', { exact: true }).fill('Customer postponed the event')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Customer postponed the event')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit lead', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Convert to project', exact: true })).toHaveCount(0)
})

test('qualified lead waits for a client, locks corrections, and allows first client selection', async ({ page }) => {
  const state = await setup(page, { lead: { stage: 'qualified' } })
  await page.goto(`/app/leads/${id}`)
  await expect(page.getByText('Waiting for Client selection', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Convert to project', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Select client', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit lead' })
  await expect(dialog.getByLabel('Company name', { exact: true })).toBeDisabled()
  await choose(page, 'Client', 'Acme Client · CL-000001', dialog)
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(state.writes[0].body).toEqual({ expectedRevision: 2, clientId })
})

test('qualified client replacement requires returning with a reason and leaves captured fields locked until saved', async ({ page }) => {
  const state = await setup(page, { lead: { stage: 'qualified', clientId, contactId } })
  await page.goto(`/app/leads/${id}`)
  await page.getByRole('button', { name: 'Edit lead', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit lead' })
  await expect(dialog.getByRole('button', { name: 'Client', exact: true })).toBeDisabled()
  await choose(page, 'Stage change', 'Return to reviewing', dialog)
  await expect(dialog.getByLabel('Company name', { exact: true })).toBeDisabled()
  await choose(page, 'Client', 'Not set', dialog)
  await dialog.getByLabel('Reason', { exact: true }).fill('Review client identity')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(state.writes[0].body).toEqual({ expectedRevision: 2, clientId: null, transition: { action: 'return', reason: 'Review client identity' } })
})

test('revision conflict keeps explicit edits, refreshes untouched values, and uses a fresh request key', async ({ page }) => {
  const state = await setup(page, { mutate: async ({ state, route, url }) => {
    if (url.pathname === path && state.writes.length === 1) {
      state.lead.revision = 3
      state.lead.corrections.email = 'latest@example.com'
      await route.fulfill({ status: 409, json: { error: { code: 'INQUIRY_CONFLICT', message: 'Lead changed' } } })
      return true
    }
  } })
  await page.goto(`/app/leads/${id}`)
  await page.getByRole('button', { name: 'Edit lead', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit lead' })
  await dialog.getByLabel('Company name', { exact: true }).fill('My edit')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(dialog.getByRole('region', { name: 'Review lead conflict' })).toContainText('latest@example.com')
  await expect(dialog.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Use latest revision and keep my edits' }).click()
  await expect(dialog.getByLabel('Company name', { exact: true })).toHaveValue('My edit')
  await expect(dialog.getByLabel('Email address', { exact: true })).toHaveValue('latest@example.com')
  await dialog.getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(dialog.getByLabel('Company name', { exact: true })).toHaveValue('Acme Studio')
  await expect(dialog.getByLabel('Email address', { exact: true })).toHaveValue('latest@example.com')
  await expect(dialog.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  await dialog.getByLabel('Company name', { exact: true }).fill('My edit')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(state.writes[1].body).toEqual({ expectedRevision: 3, corrections: { companyName: 'My edit' } })
  expect(state.writes[1].key).not.toBe(state.writes[0].key)
})

test('uncertain save locks edits and retries exactly the original UUID and body', async ({ page }) => {
  const state = await setup(page, { mutate: async ({ state, route, url }) => {
    if (url.pathname === path && state.writes.length === 1) {
      await route.fulfill({ status: 503, json: { error: { message: 'Retry later' } } })
      return true
    }
  } })
  await page.goto(`/app/leads/${id}`)
  await page.getByRole('button', { name: 'Edit lead', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit lead' })
  await dialog.getByLabel('Company name', { exact: true }).fill('Recovered edit')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(dialog.getByLabel('Company name', { exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Dismiss error' }).click()
  await dialog.getByRole('button', { name: 'Retry same request' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(state.writes[1]).toEqual(state.writes[0])
  expect(state.writes[0].key).toMatch(/^[\da-f-]{36}$/)
})

test('conversion copies only the supported command and follows the returned immutable project reference', async ({ page }) => {
  const state = await setup(page, { lead: { stage: 'qualified', clientId } })
  await page.goto(`/app/leads/${id}`)
  await page.getByRole('button', { name: 'Convert to project', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Convert lead to project' })
  await dialog.getByLabel('Project name').fill('Acme launch')
  await dialog.getByRole('button', { name: 'Convert to project', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(state.writes[0].body).toEqual({ expectedRevision: 2, name: 'Acme launch' })
  await expect(page.getByText('Converted to project · PRJ-0123ABCD')).toBeVisible()
  await page.getByRole('button', { name: 'View linked project' }).click()
  await expect(page.getByRole('dialog', { name: 'Linked project' })).toContainText('Acme launch')
})

test('conversion with an unknown outcome retries the same command exactly once', async ({ page }) => {
  const state = await setup(page, { lead: { stage: 'qualified', clientId }, mutate: async ({ state, route, url }) => {
    if (url.pathname === `${path}/convert` && state.writes.length === 1) {
      await route.fulfill({ status: 503, json: { error: { message: 'Conversion outcome unavailable' } } })
      return true
    }
  } })
  await page.goto(`/app/leads/${id}`)
  await page.getByRole('button', { name: 'Convert to project', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Convert lead to project' })
  await dialog.getByRole('button', { name: 'Convert to project', exact: true }).click()
  await expect(dialog.getByLabel('Project name')).toBeDisabled()
  await page.getByRole('button', { name: 'Dismiss error', exact: true }).click()
  await dialog.getByRole('button', { name: 'Retry same request', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(state.writes).toHaveLength(2)
  expect(state.writes[1]).toEqual(state.writes[0])
})

test('competing conversion reloads the already converted lead without creating another project', async ({ page }) => {
  const state = await setup(page, { lead: { stage: 'qualified', clientId }, mutate: async ({ state, route, url }) => {
    if (url.pathname === `${path}/convert`) {
      state.lead = { ...state.lead, stage: 'converted', revision: 3, projectId: '507f1f77bcf86cd799439055' }
      await route.fulfill({ status: 409, json: { error: { code: 'INQUIRY_CONFLICT', message: 'Already converted' } } })
      return true
    }
  } })
  await page.goto(`/app/leads/${id}`)
  await page.getByRole('button', { name: 'Convert to project', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Convert lead to project' })
  await dialog.getByRole('button', { name: 'Convert to project', exact: true }).click()
  await dialog.getByRole('button', { name: 'Use latest revision and keep my edits' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('This lead was already converted. Latest details loaded.')).toBeVisible()
  expect(state.writes).toHaveLength(1)
})

test('activity reads the array response and pages by targetRevision including revision zero', async ({ page }) => {
  const state = await setup(page, { activity: ({ url, reply }) => reply(url.searchParams.has('beforeRevision')
    ? [{ _id: 'event-0', event: 'created', targetRevision: 0, actorType: 'public', changedFields: [], createdAt: sample.createdAt }]
    : Array.from({ length: 25 }, (_, index) => ({ _id: `event-${25 - index}`, event: 'edited', targetRevision: 25 - index, actorType: 'staff', actorId: member, changedFields: ['companyName'], createdAt: sample.createdAt }))) })
  await page.goto(`/app/leads/${id}`)
  await page.getByRole('tab', { name: 'Activity', exact: true }).click()
  await expect(page.getByText('Lead details updated', { exact: true })).toHaveCount(25)
  await page.getByRole('button', { name: 'Older activity', exact: true }).click()
  await expect(page.getByText('Lead captured', { exact: true })).toBeVisible()
  expect(state.requests.filter(item => item.url.pathname === `${path}/activity`).at(-1).url.searchParams.get('beforeRevision')).toBe('1')
  await expect(page.getByRole('button', { name: 'Older activity', exact: true })).toBeDisabled()
})

for (const access of [{ name: 'view only', grants: ['inquiries.view'] }, { name: 'billing paused', writesAllowed: false }]) {
  test(`${access.name} keeps detail and activity readable with no edit or conversion controls`, async ({ page }) => {
    const state = await setup(page, access)
    await page.goto(`/app/leads/${id}`)
    await expect(page.getByRole('heading', { name: 'Acme Studio' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit lead', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Convert to project', exact: true })).toHaveCount(0)
    await page.getByRole('tab', { name: 'Activity', exact: true }).click()
    await expect(page.getByText('Review started', { exact: true })).toBeVisible()
    expect(state.writes).toHaveLength(0)
  })
}

test('detail permission denial prevents lead, assignment, client and activity reads', async ({ page }) => {
  const state = await setup(page, { grants: ['clients.view'] })
  await page.goto(`/app/leads/${id}`)
  await expect(page.getByRole('heading', { name: 'Access is limited' })).toBeVisible()
  expect(state.requests.filter(item => /\/inquiries|\/assignment-options|\/clients/.test(item.url.pathname))).toHaveLength(0)
})

test('notification deep link opens its exact workspace rather than the first available organization', async ({ page }) => {
  const state = await setup(page, { organizations: [{ id: otherOrg, name: 'Other workspace', status: 'active' }, { id: org, name: 'Acme workspace', status: 'active' }] })
  await page.goto(`/organizations/${org}/inquiries/${id}`)
  await expect(page.getByRole('heading', { name: 'Acme Studio' })).toBeVisible()
  await page.getByRole('link', { name: 'Back to leads', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'Acme Studio', exact: true })).toBeVisible()
  expect(state.requests.some(item => item.url.pathname.startsWith(`/api/v1/organizations/${otherOrg}/`))).toBe(false)
})

test('signed-out assignment link keeps its destination through sign-in and return to the lead list', async ({ page }) => {
  const state = await setup(page, { signedOut: true, organizations: [{ id: otherOrg, name: 'Other workspace', status: 'active' }, { id: org, name: 'Acme workspace', status: 'active' }] })
  await page.route(`${authUrl}/auth/v1/token?grant_type=password`, route => route.fulfill({ json: makeSession() }))
  await page.goto(`/organizations/${org}/inquiries/${id}`)
  await page.getByLabel('Email address', { exact: true }).fill('alex@example.com')
  await page.getByLabel('Password', { exact: true }).fill('StrongPassword1')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Acme Studio' })).toBeVisible()
  await expect(page).toHaveURL(`/organizations/${org}/inquiries/${id}`)
  await page.getByRole('link', { name: 'Back to leads', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'Acme Studio', exact: true })).toBeVisible()
  expect(state.requests.some(item => item.url.pathname.startsWith(`/api/v1/organizations/${otherOrg}/`))).toBe(false)
})

test('a missing linked workspace never falls back to another organization', async ({ page }) => {
  const state = await setup(page, { organizations: [{ id: otherOrg, name: 'Other workspace', status: 'active' }] })
  await page.goto(`/organizations/${org}/inquiries/${id}`)
  await expect(page.getByRole('heading', { name: 'Linked workspace unavailable' })).toBeVisible()
  expect(state.requests.some(item => item.url.pathname.includes('/inquiries/'))).toBe(false)
})

test('a linked workspace on a later directory page loads without reading the first workspace', async ({ page }) => {
  const state = await setup(page, { organizations: [{ id: otherOrg, name: 'Other workspace', status: 'active' }], organizationNext: 'later' })
  await page.route('**/api/v1/organizations?**', route => route.fulfill({ json: { data: { items: [{ id: org, name: 'Acme workspace', status: 'active' }], next: null } } }))
  await page.goto(`/organizations/${org}/inquiries/${id}`)
  await page.getByRole('button', { name: 'Load more workspaces' }).click()
  await expect(page.getByRole('heading', { name: 'Acme Studio' })).toBeVisible()
  expect(state.requests.some(item => item.url.pathname.startsWith(`/api/v1/organizations/${otherOrg}/`))).toBe(false)
})

test('owner filtering resets a cursor bound to the previous owner', async ({ page }) => {
  const state = await setup(page)
  const next = { createdAt: sample.createdAt, id, scope: 'a'.repeat(64) }
  await page.route(`**${base}/inquiries?**`, route => route.fulfill({ json: { data: { items: [state.lead], next } } }))
  await page.goto('/app/leads')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Lead owner filter', exact: true })).toBeVisible()
  const request = page.waitForRequest(request => new URL(request.url()).searchParams.get('ownerId') === member)
  await choose(page, 'Lead owner filter', 'Alex Smith')
  expect(new URL((await request).url()).searchParams.has('before')).toBe(false)
})

test('new client remains selected after a failed lead save and is not created twice', async ({ page }) => {
  const state = await setup(page, { mutate: async ({ state, route, url }) => {
    if (url.pathname === path && state.writes.filter(item => item.path === path).length === 1) {
      await route.fulfill({ status: 400, json: { error: { code: 'INVALID_REQUEST', message: 'Review your selection' } } })
      return true
    }
  } })
  await page.goto(`/app/leads/${id}`)
  await page.getByRole('button', { name: 'Edit lead', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit lead' })
  await dialog.getByRole('button', { name: 'Create a new client', exact: true }).click()
  const create = page.getByRole('dialog', { name: 'Create client', exact: true })
  await create.getByLabel('Client name').fill('New client')
  await create.getByRole('button', { name: 'Create and select client' }).click()
  await expect(create).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Review your selection')
  await page.getByRole('button', { name: 'Dismiss error', exact: true }).click()
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(dialog).toHaveCount(0)
  expect(state.writes.filter(item => item.path === `${base}/clients`)).toHaveLength(1)
  expect(state.writes.filter(item => item.path === path).map(item => item.body.clientId)).toEqual([clientId, clientId])
})

test('private intake settings mask links and require explicit regeneration confirmation', async ({ page }) => {
  const state = await setup(page, { owner: true })
  await page.goto('/app/leads')
  await page.getByRole('button', { name: 'Intake settings' }).click()
  const dialog = page.getByRole('dialog', { name: 'Lead intake settings' })
  await expect(dialog.getByLabel('Private intake URL')).toHaveAttribute('type', 'password')
  await expect(dialog.getByRole('button', { name: /enable|publish/i })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Regenerate link' }).click()
  const confirm = page.getByRole('dialog', { name: 'Regenerate intake link?' })
  await expect(confirm).toContainText('previous link becomes invalid')
  await confirm.getByRole('button', { name: 'Regenerate link' }).click()
  await expect.poll(() => state.writes.length).toBe(1)
  expect(state.writes[0].body).toEqual({ expectedRevision: 3 })
  expect(state.writes[0].path).toBe(`${base}/inquiry-form/rotate`)
})

for (const mode of ['light', 'dark']) {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 834, height: 724 }, { width: 375, height: 812 }, { width: 320, height: 640 }]) {
    test(`Add lead keeps actions visible at ${viewport.width}x${viewport.height} in ${mode}`, async ({ page }, testInfo) => {
      await setup(page)
      await page.addInitScript(theme => localStorage.setItem('theme', theme), mode)
      await page.setViewportSize(viewport)
      await page.goto('/app/leads')
      await page.getByRole('button', { name: 'Add lead', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Add lead', exact: true })
      const submit = dialog.getByRole('button', { name: 'Add lead', exact: true })
      await expect(dialog.getByRole('button', { name: 'Lead owner', exact: true })).toBeEnabled()
      await expect(submit).toBeInViewport()
      await expect(dialog.getByLabel('Company name', { exact: true })).toBeFocused()
      const main = await dialog.locator('.lead-create-main').boundingBox()
      const sidebar = await dialog.getByRole('complementary', { name: 'Lead setup' }).boundingBox()
      if (viewport.width > 850) expect(sidebar.x).toBeGreaterThanOrEqual(main.x + main.width - 1)
      else expect(sidebar.y).toBeGreaterThanOrEqual(main.y + main.height - 1)
      const overflow = await dialog.evaluate(node => node.scrollWidth - node.clientWidth)
      expect(overflow).toBeLessThanOrEqual(1)
      await page.screenshot({ path: testInfo.outputPath(`lead-add-${mode}-${viewport.width}.png`) })
      await dialog.getByLabel('Company name', { exact: true }).fill('Acme Studio')
      await dialog.locator('summary').click()
      await expect(dialog.locator('.lead-create-client')).toHaveAttribute('open', '')
      await expect(dialog.getByRole('button', { name: 'Client', exact: true })).toBeVisible()
      await dialog.locator('.lead-create-body').evaluate(node => { node.scrollTop = node.scrollHeight })
      await expect(submit).toBeInViewport()
      await expect(dialog.getByRole('heading', { name: 'Add lead', exact: true })).toBeInViewport()
      const bottom = (await submit.boundingBox()).y + (await submit.boundingBox()).height
      expect(bottom).toBeLessThanOrEqual(viewport.height - 4)
      await page.screenshot({ path: testInfo.outputPath(`lead-add-expanded-${mode}-${viewport.width}.png`) })
    })
  }

  test(`lead detail and edit form fit mobile in ${mode} mode`, async ({ page }, testInfo) => {
    await setup(page)
    await page.addInitScript(theme => localStorage.setItem('theme', theme), mode)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`/app/leads/${id}`)
    await expect(page.getByRole('heading', { name: 'Acme Studio' })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
    await page.screenshot({ path: testInfo.outputPath(`lead-detail-${mode}.png`), fullPage: true })
    await page.getByRole('button', { name: 'Edit lead', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Edit lead' })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
    await page.screenshot({ path: testInfo.outputPath(`lead-edit-${mode}.png`), fullPage: true })
  })
}
