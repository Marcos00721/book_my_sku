import { expect, test } from '@playwright/test'
import { mockSignedIn } from './helpers/auth'
import { mockGeography } from './helpers/geography'

const org = '507f1f77bcf86cd799439011'
const clientId = '507f1f77bcf86cd799439021'
const base = `/organizations/${org}/clients/${clientId}`
const addressId = '507f1f77bcf86cd799439031'

async function setup(page, { editable = true, archived = false } = {}) {
  await mockSignedIn(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('https://fonts.googleapis.com/**', route => route.abort())
  await page.route('https://fonts.gstatic.com/**', route => route.abort())
  const writes = []
  const queries = []
  const client = { _id: clientId, name: 'Acme Promotions', status: archived ? 'archived' : 'active', __v: 2, defaultBillingAddressId: addressId, defaultShippingAddressId: null }
  const addresses = [
    { id: addressId, label: 'Head office', companyName: 'Acme Promotions', usage: 'both', active: true, revision: 4, readiness: { complete: true }, address: { line1: '123 Test Street', line2: 'Suite 4', city: 'Austin', region: 'Texas', postalCode: '78701', country: 'US', stateCode: 'US-TX' } },
    { id: 'draft', label: 'Warehouse', usage: 'shipping', active: true, revision: 1, readiness: { complete: false, missingFields: ['companyName', 'address.postalCode'] }, address: { line1: '12 Supply Road', city: 'Jaipur', country: 'IN' } },
    { id: 'extra', label: 'Branch office', companyName: 'Acme', usage: 'billing', active: true, revision: 1, address: { line1: '45 Street', city: 'Austin', country: 'US', stateCode: 'US-TX', postalCode: '78701' } },
    { id: 'inactive', label: 'Old office', companyName: 'Acme', usage: 'billing', active: false, revision: 2, address: { line1: '98 Old Road', city: 'Austin', country: 'US', stateCode: 'US-TX', postalCode: '78701' } },
  ]
  await page.route('**/api/v1/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace('/api/v1', '')
    const method = request.method()
    if (method !== 'GET') writes.push({ path, method, body: request.postDataJSON() })
    let data = { items: [], next: null }
    if (path === '/organizations') data = { items: [{ id: org, name: 'QA Studio', status: 'active' }] }
    else if (path.endsWith('/permissions')) data = { owner: false, grants: ['clients.view', ...(editable ? ['clients.edit'] : [])].map(key => ({ key, scope: 'all' })) }
    else if (path.endsWith('/access')) data = { state: 'normal', writesAllowed: true }
    else if (path === base) data = { ...client }
    else if (path === `${base}/management`) data = { relationshipStatus: 'customer' }
    else if (path === `${base}/addresses` && method === 'POST') {
      data = { id: 'created', revision: 0, active: true, ...request.postDataJSON() }
      addresses.unshift(data)
    } else if (path === `${base}/addresses`) {
      const query = Object.fromEntries(url.searchParams)
      queries.push(query)
      const filtered = addresses.filter(item => query.state === 'all' || (query.state === 'inactive' ? !item.active : item.active))
      data = { items: query.after ? filtered.slice(2) : filtered.slice(0, 2), next: !query.after && filtered.length > 2 ? 'next-addresses' : null }
    } else if (path === `${base}/address-defaults`) {
      const body = request.postDataJSON()
      for (const purpose of ['billing', 'shipping']) if (Object.hasOwn(body, purpose)) client[purpose === 'billing' ? 'defaultBillingAddressId' : 'defaultShippingAddressId'] = body[purpose]?.addressId || null
      client.__v++
      data = { ...client }
    } else if (path.startsWith(`${base}/addresses/`)) {
      const [id, command] = path.slice(`${base}/addresses/`.length).split('/')
      const item = addresses.find(address => address.id === id)
      if (command === 'copy') {
        data = { ...item, id: 'copied', label: 'Head office copy', revision: 0 }
        addresses.unshift(data)
      } else if (method === 'PATCH') {
        const body = request.postDataJSON()
        Object.assign(item, { ...body, address: { ...item.address, ...body.address }, revision: item.revision + 1 })
        if (!item.active || item.usage === 'shipping') client.defaultBillingAddressId = null
        if (!item.active || item.usage === 'billing') client.defaultShippingAddressId = null
        data = { ...item }
      } else data = { ...item }
    }
    await route.fulfill({ json: { data } })
  })
  await mockGeography(page)
  await page.goto(`/app/clients/${clientId}`)
  await page.getByRole('tab', { name: 'Saved addresses' }).click()
  return { writes, queries, client, addresses }
}

async function pick(dialog, label, option) {
  await dialog.getByRole('button', { name: label, exact: true }).click()
  await dialog.getByRole('option', { name: option, exact: true }).click()
}

for (const width of [320, 1440]) {
  test(`address cards, creation and copy work at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const { writes } = await setup(page)
    const panel = page.getByRole('tabpanel', { name: 'Saved addresses' })
    const office = panel.getByRole('article', { name: 'Head office', exact: true })
    await expect(office).toContainText('United States')
    await expect(office).toContainText('Austin, Texas, 78701')
    await expect(panel.getByRole('article', { name: 'Warehouse' })).toContainText('Missing: company name, postal code')
    await expect(panel.getByRole('button', { name: 'Use for shipping', exact: true })).toBeDisabled()
    await page.screenshot({ path: testInfo.outputPath(`addresses-${width}.png`), fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

    await panel.getByRole('button', { name: 'Add address', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Add address' })
    await expect(dialog.getByRole('textbox', { name: 'Label', exact: true })).toBeFocused()
    await expect(dialog.getByRole('alert')).toHaveCount(0)
    await expect(dialog.getByText('Tip', { exact: true })).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath(`add-address-${width}.png`) })
    const footer = await dialog.locator('.dialog-footer').boundingBox()
    expect(footer.y + footer.height).toBeLessThanOrEqual(900)
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(dialog.getByRole('alert').first()).toBeVisible()
    await dialog.getByRole('button', { name: 'Clear', exact: true }).click()
    await expect(dialog.getByRole('alert')).toHaveCount(0)
    await dialog.getByRole('textbox', { name: 'Label', exact: true }).fill('New office')
    await dialog.getByRole('textbox', { name: 'Company name', exact: true }).fill('Acme Promotions')
    await pick(dialog, 'Address type', 'Billing & shipping')
    await dialog.getByRole('textbox', { name: 'Address line 1', exact: true }).fill('1 New Road')
    await dialog.getByRole('textbox', { name: 'City', exact: true }).fill('Austin')
    await dialog.getByRole('textbox', { name: 'Postal code', exact: true }).fill('78701')
    await pick(dialog, 'Country', 'United States')
    await pick(dialog, 'State', 'Texas')
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    expect(writes[0].body).toEqual({ label: 'New office', companyName: 'Acme Promotions', usage: 'both', address: { line1: '1 New Road', line2: null, city: 'Austin', postalCode: '78701', country: 'US', stateCode: 'US-TX' } })
    await expect(panel.getByRole('article', { name: 'New office' })).toBeVisible()
    await panel.getByRole('button', { name: 'Copy Head office', exact: true }).click()
    await page.getByRole('dialog', { name: 'Copy address' }).getByRole('button', { name: 'Copy', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(writes[1]).toEqual({ method: 'POST', path: `${base}/addresses/${addressId}/copy`, body: { expectedSourceRevision: 4 } })
    await expect(panel.getByRole('article', { name: 'Head office copy' })).toBeVisible()
  })
}

test('address edits preserve unchanged geography and save changes made with the country/state pickers', async ({ page }) => {
  const { writes } = await setup(page)
  await page.getByRole('button', { name: 'Edit Head office', exact: true }).click()
  let dialog = page.getByRole('dialog', { name: 'Edit address' })
  await dialog.getByRole('textbox', { name: 'Label', exact: true }).fill('Main office')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(writes[0].body).toMatchObject({ expectedRevision: 4, active: true })
  expect(writes[0].body.address).not.toHaveProperty('country')
  expect(writes[0].body.address).not.toHaveProperty('stateCode')
  await page.getByRole('button', { name: 'Edit Main office', exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'Edit address' })
  await pick(dialog, 'Country', 'India')
  await expect(dialog.getByRole('button', { name: 'State', exact: true })).toHaveText('Choose a state')
  await pick(dialog, 'State', 'Rajasthan')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(writes[1].body.address).toMatchObject({ country: 'IN', stateCode: 'IN-RJ' })
  expect(writes[1].body.expectedRevision).toBe(5)
})

test('address defaults, clearing and filter pagination keep exact revisions', async ({ page }) => {
  const { writes, queries } = await setup(page)
  const panel = page.getByRole('tabpanel', { name: 'Saved addresses' })
  await panel.getByRole('button', { name: 'Use for both', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(writes[0].body).toEqual({ expectedVersion: 2, billing: { addressId, expectedRevision: 4 }, shipping: { addressId, expectedRevision: 4 } })
  const office = panel.getByRole('article', { name: 'Head office', exact: true })
  await expect(office).toContainText('shipping default')
  await expect(office.getByRole('button', { name: 'Use for both' })).toHaveCount(0)
  await panel.getByRole('button', { name: 'Clear billing default', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(writes[1].body).toEqual({ expectedVersion: 3, billing: null })
  await panel.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(panel.getByRole('article', { name: 'Branch office' })).toBeVisible()
  expect(queries.at(-1).after).toBe('next-addresses')
  await panel.getByRole('button', { name: 'Status', exact: true }).click()
  await page.getByRole('option', { name: 'Inactive', exact: true }).click()
  const oldOffice = panel.getByRole('article', { name: 'Old office' })
  await expect(oldOffice).toBeVisible()
  expect(queries.at(-1).after).toBeUndefined()
  expect(queries.at(-1).state).toBe('inactive')
  await oldOffice.getByRole('button', { name: 'Edit Old office' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit address' })
  await dialog.getByRole('checkbox', { name: 'Active address', exact: true }).check()
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(writes[2].body).toMatchObject({ active: true, expectedRevision: 2 })
  await expect(panel.getByRole('heading', { name: 'No matching addresses' })).toBeVisible()
})

for (const options of [{ editable: false }, { archived: true }]) {
  test(`addresses stay read-only with ${JSON.stringify(options)}`, async ({ page }) => {
    await setup(page, options)
    const panel = page.getByRole('tabpanel', { name: 'Saved addresses' })
    await expect(panel.getByRole('article', { name: 'Head office', exact: true })).toBeVisible()
    await expect(panel.getByRole('button', { name: /Add address|Edit Head office|Copy Head office|Use for both|Clear billing/ })).toHaveCount(0)
  })
}

test('Clear restores saved geography and a country without states saves a null state code', async ({ page }) => {
  const { writes } = await setup(page)
  await page.getByRole('button', { name: 'Edit Head office', exact: true }).click()
  let dialog = page.getByRole('dialog', { name: 'Edit address' })
  await pick(dialog, 'Country', 'India')
  await dialog.getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Country', exact: true })).toHaveText('United States')
  await expect(dialog.getByRole('button', { name: 'State', exact: true })).toHaveText('Texas')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(writes[0].body.address).not.toHaveProperty('country')
  expect(writes[0].body.address).not.toHaveProperty('stateCode')

  await page.route('**/api/v1/reference/countries', route => route.fulfill({ json: { data: { countries: [
    { code: 'US', name: 'United States', stateLabel: 'State', stateRequirement: 'required' },
    { code: 'SG', name: 'Singapore', stateLabel: 'State', stateRequirement: 'not_applicable' },
  ] } } }))
  await page.route('**/api/v1/reference/countries/SG/states', route => route.fulfill({ json: { data: { states: [] } } }))
  await page.getByRole('button', { name: 'Edit Head office', exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'Edit address' })
  await pick(dialog, 'Country', 'Singapore')
  await expect(dialog.getByRole('button', { name: 'State', exact: true })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'State', exact: true })).toHaveText('Not applicable')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(writes[1].body.address).toMatchObject({ country: 'SG', stateCode: null })
})
