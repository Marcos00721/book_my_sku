import { expect, test } from '@playwright/test'
import { mockSignedIn, mockOnboardingStatus } from './helpers/auth'
import { mockGeography } from './helpers/geography'

test.beforeEach(async ({ page }) => {
  // Keep browser QA independent of third-party font availability.
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
})

const orgA = '507f1f77bcf86cd799439011'
const orgB = '507f1f77bcf86cd799439012'
const clientId = '507f1f77bcf86cd799439021'
const applicationId = '507f1f77bcf86cd799439031'
const roleId = '507f1f77bcf86cd799439041'
const client = {
  _id: clientId,
  organizationId: orgA,
  name: 'Acme Promotions',
  status: 'active',
  __v: 2,
  createdAt: '2026-10-18T00:00:00Z',
  defaultBillingAddressId: null,
  defaultShippingAddressId: null,
}
const application = {
  id: applicationId,
  status: 'approved',
  revision: 2,
  companyName: 'Acme Promotions',
  email: 'alex@example.com',
}
const allGrants = [
  'clients.view',
  'clients.create',
  'clients.edit',
  'contacts.view',
  'contacts.create',
  'contacts.edit',
].map((key) => ({ key, scope: key.endsWith('create') ? 'none' : 'all' }))

async function workspace(
  page,
  {
    owner = true,
    grants = allGrants,
    writesAllowed = true,
    multiple = false,
  } = {},
) {
  await mockSignedIn(page)
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '')
    expect(route.request().headers().authorization).toBe(
      'Bearer registration-access-token',
    )
    const orgs = [
      { id: orgA, name: 'Acme Promotions', status: 'active', owner },
      ...(multiple
        ? [{ id: orgB, name: 'Second Studio', status: 'active', owner }]
        : []),
    ]
    const data =
      path === '/organizations'
        ? { items: orgs, next: null }
        : path.endsWith('/permissions')
          ? {
              owner,
              organizationId: path.split('/')[2],
              role: owner ? null : { name: 'Client viewer' },
              grants,
            }
          : path.endsWith('/access')
            ? {
                state: writesAllowed ? 'normal' : 'restricted',
                writesAllowed,
                nextAction: writesAllowed ? 'none' : 'payment_recovery',
              }
            : path === `/organizations/${orgA}/clients/${clientId}`
              ? client
              : path.endsWith('/clients')
                ? {
                    items: [
                      {
                        ...client,
                        name: path.includes(orgB)
                          ? 'Studio Client'
                          : client.name,
                      },
                    ],
                    next: null,
                  }
                : path.endsWith('/roles/catalog')
                  ? {
                      items: allGrants.map((grant) => ({
                        key: grant.key,
                        label: grant.key,
                        enabled: true,
                        scopes: [grant.scope],
                        revision: 0,
                      })),
                    }
                  : path.endsWith('/roles')
                    ? {
                        items: [
                          {
                            id: roleId,
                            name: 'Client manager',
                            revision: 0,
                            grants: allGrants,
                            archived: false,
                          },
                        ],
                        next: null,
                      }
                    : { items: [], next: null }
    await route.fulfill({ json: { data } })
  })
}

test('client mutations recover an uncertain response with the same UUID and body', async ({
  page,
}) => {
  await workspace(page)
  const requests = []
  await page.route(`**/organizations/${orgA}/clients`, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    requests.push({
      key: route.request().headers()['idempotency-key'],
      body: route.request().postDataJSON(),
    })
    return requests.length === 1
      ? route.fulfill({
          status: 503,
          json: {
            error: {
              code: 'INTERNAL_ERROR',
              message: 'The save response was interrupted.',
            },
          },
        })
      : route.fulfill({ status: 201, json: { data: client } })
  })
  await page.goto('/app/clients')
  await page.getByRole('button', { name: 'Add client', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Client name').fill('Acme Promotions')
  await dialog
    .getByRole('button', { name: 'Create client', exact: true })
    .click()
  await expect(dialog.getByLabel('Client name')).toBeDisabled()
  await dialog.getByRole('button', { name: 'Retry same request' }).click()
  await expect(page).toHaveURL(`/app/clients/${clientId}`)
  expect(requests).toHaveLength(2)
  expect(requests[0]).toEqual(requests[1])
  expect(requests[0].key).toMatch(/^[a-f\d-]{36}$/)
})

test('workspace switches remove previous tenant records before the next response arrives', async ({
  page,
}) => {
  await workspace(page, { multiple: true })
  await page.goto('/app/clients')
  await expect(
    page.getByRole('link', { name: 'Acme Promotions', exact: true }),
  ).toBeVisible()
  await page.getByLabel('Switch workspace').selectOption(orgB)
  await expect(
    page.getByRole('link', { name: 'Acme Promotions', exact: true }),
  ).toHaveCount(0)
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Clients', exact: true })
    .click()
  await expect(
    page.getByRole('link', { name: 'Studio Client', exact: true }),
  ).toBeVisible()
})

test('restricted billing preserves reads while hiding client writes', async ({
  page,
}) => {
  await workspace(page, { writesAllowed: false })
  await page.goto('/app/clients')
  await expect(
    page.getByRole('link', { name: 'Acme Promotions', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Add client', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByText('Workspace changes are paused.', { exact: false }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Acme Promotions', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Rename client' })).toHaveCount(
    0,
  )
})

test('permission denial refreshes effective permissions without legacy role fallback', async ({
  page,
}) => {
  await workspace(page, {
    owner: false,
    grants: [{ key: 'clients.view', scope: 'all' }],
  })
  let revoked = false
  await page.route(`**/organizations/${orgA}/permissions`, (route) =>
    route.fulfill({
      json: {
        data: {
          owner: false,
          grants: revoked ? [] : [{ key: 'clients.view', scope: 'all' }],
        },
      },
    }),
  )
  await page.route(`**/organizations/${orgA}/clients?*`, (route) => {
    revoked = true
    return route.fulfill({
      status: 403,
      json: {
        error: {
          code: 'PERMISSION_DENIED',
          message: 'Client access was removed.',
        },
      },
    })
  })
  await page.goto('/app/clients')
  await expect(
    page.getByRole('heading', { name: 'Access is limited' }),
  ).toBeVisible()
  await expect(
    page
      .getByRole('navigation')
      .getByRole('link', { name: 'Clients', exact: true }),
  ).toHaveCount(0)
  await page.goto('/app/team')
  await expect(
    page.getByRole('heading', { name: 'Access is limited' }),
  ).toBeVisible()
})

test('client prefix search keeps opaque cursors with the same search and resets them on a new search', async ({
  page,
}) => {
  await workspace(page)
  const queries = []
  await page.route(`**/organizations/${orgA}/clients?*`, (route) => {
    const params = new URL(route.request().url()).searchParams
    queries.push(Object.fromEntries(params))
    return route.fulfill({
      json: {
        data: {
          items: [client],
          next: params.has('after') ? null : 'opaque-client-cursor',
        },
      },
    })
  })
  await page.goto('/app/clients')
  await page.getByLabel('Search clients').fill('Ac')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect.poll(() => queries.at(-1)?.search).toBe('Ac')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect.poll(() => queries.at(-1)?.after).toBe('opaque-client-cursor')
  expect(queries.at(-1).search).toBe('Ac')
  await page.getByLabel('Search clients').fill('Other')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect.poll(() => queries.at(-1)?.search).toBe('Other')
  expect(queries.at(-1).after).toBeUndefined()
})

test('contact edits use server revisions and clear optional fields explicitly', async ({
  page,
}) => {
  await workspace(page)
  const contact = {
    _id: '507f1f77bcf86cd799439051',
    name: 'Alex Smith',
    email: 'alex@acme.example',
    phone: '+1 555 123 4567',
    jobTitle: 'Manager',
    __v: 7,
  }
  await page.route(`**/clients/${clientId}/contacts?*`, (route) =>
    route.fulfill({ json: { data: { items: [contact], next: null } } }),
  )
  let submitted
  await page.route(`**/contacts/${contact._id}`, (route) => {
    submitted = route.request().postDataJSON()
    return route.fulfill({
      status: 409,
      json: {
        error: {
          code: 'VERSION_CONFLICT',
          message: 'Contact changed. Reload before saving.',
        },
      },
    })
  })
  await page.goto(`/app/clients/${clientId}`)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Email address').fill('')
  await dialog.getByRole('button', { name: 'Save contact' }).click()
  await expect(dialog.getByRole('alert')).toContainText('VERSION_CONFLICT')
  expect(submitted).toEqual({
    name: contact.name,
    email: null,
    phone: contact.phone,
    jobTitle: contact.jobTitle,
    expectedVersion: 7,
  })
})

test('address creation selects supported geography and can become both defaults', async ({ page }) => {
  await workspace(page)
  await mockGeography(page)
  let submitted, defaults, created = false
  const addressId = '507f1f77bcf86cd799439062'
  await page.route(`**/clients/${clientId}/addresses**`, route => {
    if (route.request().method() === 'POST') {
      submitted = route.request().postDataJSON()
      created = true
      return route.fulfill({ status: 201, json: { data: { id: addressId, revision: 0, ...submitted } } })
    }
    return route.fulfill({ json: { data: { items: created ? [{ id: addressId, revision: 0, active: true, ...submitted }] : [], next: null } } })
  })
  await page.route(`**/clients/${clientId}/address-defaults`, route => {
    defaults = route.request().postDataJSON()
    return route.fulfill({ json: { data: { ...client, __v: 3 } } })
  })
  await page.goto(`/app/clients/${clientId}`)
  await page.getByRole('tab', { name: 'Saved addresses' }).click()
  await page.getByRole('button', { name: 'Add address' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Label', {exact: true}).fill('QA Billing and Shipping')
  await dialog.getByLabel('Use this address for').selectOption('both')
  await dialog.getByLabel('Address line 1', {exact: true}).fill('123 Test Street')
  await dialog.getByLabel('City', {exact: true}).fill('Austin')
  await dialog.getByLabel('Postal code', {exact: true}).fill('78701')
  await dialog.getByRole('combobox', {name: 'Country', exact: true}).selectOption('US')
  await dialog.getByRole('combobox', {name: 'State', exact: true}).selectOption('US-TX')
  await dialog.getByRole('combobox', {name: 'Country', exact: true}).selectOption('IN')
  await expect(dialog.getByRole('combobox', {name: 'State', exact: true})).toHaveValue('')
  await dialog.getByRole('combobox', {name: 'Country', exact: true}).selectOption('US')
  await dialog.getByRole('combobox', {name: 'State', exact: true}).selectOption('US-TX')
  await dialog.getByRole('button', {name: 'Save address', exact: true}).click()
  await expect(dialog).toHaveCount(0)
  expect(submitted.address).toMatchObject({ country: 'US', stateCode: 'US-TX', city: 'Austin', postalCode: '78701' })
  expect(submitted.address).not.toHaveProperty('region')
  await page.getByRole('button', {name: 'Use for both'}).click()
  await page.getByRole('dialog').getByRole('button', {name: 'Confirm', exact: true}).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(defaults).toEqual({expectedVersion: 2, billing: {addressId, expectedRevision: 0}, shipping: {addressId, expectedRevision: 0}})
})

test('shared address defaults send the exact client and address revisions', async ({
  page,
}) => {
  await workspace(page)
  const address = {
    id: '507f1f77bcf86cd799439061',
    label: 'Main office',
    usage: 'both',
    active: true,
    revision: 4,
    address: { line1: '1 Example Road', city: 'Jaipur', country: 'IN' },
  }
  await page.route(`**/clients/${clientId}/addresses?*`, (route) =>
    route.fulfill({ json: { data: { items: [address], next: null } } }),
  )
  let submitted
  await page.route(`**/clients/${clientId}/address-defaults`, (route) => {
    submitted = route.request().postDataJSON()
    return route.fulfill({
      json: {
        data: {
          ...client,
          __v: 3,
          defaultBillingAddressId: address.id,
          defaultShippingAddressId: address.id,
        },
      },
    })
  })
  await page.goto(`/app/clients/${clientId}`)
  await page.getByRole('tab', { name: 'Saved addresses' }).click()
  await expect(
    page.getByText('Billing & shipping · shared record'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Use for both' }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirm', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(submitted).toEqual({
    expectedVersion: 2,
    billing: { addressId: address.id, expectedRevision: 4 },
    shipping: { addressId: address.id, expectedRevision: 4 },
  })
})

async function mockSetup(page) {
  await mockSignedIn(page)
  await mockGeography(page)
  await mockOnboardingStatus(page, application)
  await page.route('**/onboarding/setup', (route) =>
    route.fulfill({
      json: {
        data: {
          revision: 0,
          address: {},
          industry: '',
          asiNumber: '',
          mode: 'shared',
          complete: false,
          locked: false,
        },
      },
    }),
  )
  await page.route(`**/applications/${applicationId}/billing`, (route) =>
    route.fulfill({
      json: {
        data: {
          status: 'not_started',
          quantity: 1,
          synchronization: 'pending_refresh',
          billingEligible: false,
          terms: null,
        },
      },
    }),
  )
}
const offer = {
  state: 'available',
  checkoutAllowed: true,
  initialQuantity: 1,
  taxes: 'not_enabled',
  offer: {
    revision: 3,
    currency: 'usd',
    interval: 'month',
    phases: [
      { kind: 'trial', months: 2, unitAmountMinor: 0 },
      { kind: 'discount', months: 3, unitAmountMinor: 2450 },
      { kind: 'standard', months: null, unitAmountMinor: 4900 },
    ],
  },
  consent: {
    termsVersion: 'recurring-v2',
    termsUrl: 'https://example.com/terms',
  },
}

test('Checkout uses exact offer consent and invalidates consent after a price revision conflict', async ({
  page,
}) => {
  await mockSetup(page)
  let revision = 3
  await page.route(`**/billing/offer`, (route) =>
    route.fulfill({
      json: { data: { ...offer, offer: { ...offer.offer, revision } } },
    }),
  )
  let submitted
  await page.route('**/billing/checkout', (route) => {
    submitted = route.request().postDataJSON()
    revision = 4
    return route.fulfill({
      status: 409,
      json: {
        error: {
          code: 'OFFER_REVISION_CONFLICT',
          message: 'The offer changed. Please review it again.',
        },
      },
    })
  })
  await page.goto('/setup')
  await expect(page.getByText('$24.50', { exact: true })).toBeVisible()
  const checkout = page.getByRole('button', {
    name: 'Continue to secure Checkout',
  })
  await expect(checkout).toBeDisabled()
  await page
    .getByRole('checkbox', { name: /I agree to recurring billing/ })
    .check()
  await checkout.click()
  await expect(page.getByRole('alert')).toContainText('OFFER_REVISION_CONFLICT')
  expect(submitted).toEqual({
    expectedOfferRevision: 3,
    recurringConsent: true,
    termsVersion: 'recurring-v2',
  })
  await page
    .getByRole('button', { name: 'Reload offer and review again' })
    .click()
  await expect(
    page.getByRole('checkbox', { name: /I agree to recurring billing/ }),
  ).not.toBeChecked()
  await expect(checkout).toBeDisabled()
})

test('restarting Checkout recovers a server-verified existing session without creating a new one', async ({
  page,
}) => {
  await mockSetup(page)
  await page.route('**/billing/offer', (route) =>
    route.fulfill({
      json: {
        data: { state: 'billing_started', checkoutAllowed: false, offer: null },
      },
    }),
  )
  await page.route('**/billing/recovery', (route) =>
    route.fulfill({
      json: {
        data: {
          state: 'payment_required',
          nextAction: 'open_payment_page',
          reason: 'card_setup_required',
          paymentUrl: 'https://checkout.stripe.com/c/pay/existing-session',
        },
      },
    }),
  )
  let checkouts = 0
  page.on('request', (request) => {
    if (request.url().endsWith('/checkout')) checkouts++
  })
  await page.goto('/setup?payment=success')
  await page.getByRole('button', { name: 'Resume payment / recover' }).click()
  await expect(
    page.getByRole('link', { name: 'Continue secure payment' }),
  ).toHaveAttribute(
    'href',
    'https://checkout.stripe.com/c/pay/existing-session',
  )
  expect(checkouts).toBe(0)
  await expect(page.getByText('Awaiting current verification')).toBeVisible()
})

test('unsafe payment redirects are rejected', async ({ page }) => {
  await mockSetup(page)
  await page.route('**/billing/offer', (route) =>
    route.fulfill({ json: { data: offer } }),
  )
  await page.route('**/billing/checkout', (route) =>
    route.fulfill({
      json: {
        data: {
          checkoutUrl: 'https://checkout.stripe.com.attacker.example/pay',
        },
      },
    }),
  )
  await page.goto('/setup')
  await page
    .getByRole('checkbox', { name: /I agree to recurring billing/ })
    .check()
  await page
    .getByRole('button', { name: 'Continue to secure Checkout' })
    .click()
  await expect(page.getByRole('alert')).toContainText(
    'payment link could not be verified',
  )
  await expect(page).toHaveURL('/setup')
})

test('company setup saves and completes with the returned revision and no storage selector', async ({
  page,
}) => {
  await mockSetup(page)
  await page.route('**/billing/offer', (route) =>
    route.fulfill({ json: { data: { state: 'awaiting_offer', offer: null } } }),
  )
  let patch, completion
  await page.route('**/onboarding/setup', (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback()
    patch = route.request().postDataJSON()
    return route.fulfill({
      json: { data: { revision: 1, complete: false, locked: false } },
    })
  })
  await page.route('**/onboarding/setup/complete', (route) => {
    completion = route.request().postDataJSON()
    return route.fulfill({
      json: { data: { revision: 2, complete: true, locked: false } },
    })
  })
  await page.goto('/setup')
  await page
    .getByLabel('Industry', { exact: true })
    .fill('Promotional products')
  await page
    .getByLabel('Address line 1', { exact: true })
    .fill('1 Example Road')
  await page.getByLabel('City', { exact: true }).fill('Jaipur')
  await page.getByLabel('Postal code', { exact: true }).fill('302001')
  await page.getByRole('combobox', { name: 'Country', exact: true }).selectOption('IN')
  await page.getByRole('combobox', { name: 'State', exact: true }).selectOption('IN-RJ')
  await page.getByRole('button', { name: 'Save company details' }).click()
  await page.getByRole('button', { name: 'Complete company setup' }).click()
  await expect.poll(() => completion?.expectedRevision).toBe(1)
  expect(patch.expectedRevision).toBe(0)
  expect(patch.address.country).toBe('IN')
  expect(patch.address.stateCode).toBe('IN-RJ')
  expect(patch.address).not.toHaveProperty('region')
  expect(patch).not.toHaveProperty('mode')
  await expect(page.getByLabel(/database|storage/i)).toHaveCount(0)
})

test('invitation tokens leave the URL immediately and acceptance does not start owner billing', async ({
  page,
}) => {
  await workspace(page)
  const invitationId = '507f1f77bcf86cd799439071'
  const privateToken = 'test-invitation-token-stays-in-memory'
  let submitted
  await page.route(`**/invitations/${invitationId}/accept`, (route) => {
    submitted = route.request().postDataJSON()
    return route.fulfill({ json: { data: { state: 'accepted' } } })
  })
  const requested = []
  page.on('request', (request) => requested.push(request.url()))
  await page.goto(
    `/team/accept#organizationId=${orgA}&invitationId=${invitationId}&token=${privateToken}`,
  )
  await expect(page).toHaveURL('/team/accept')
  await page.getByRole('button', { name: 'Accept invitation' }).click()
  await expect(page).toHaveURL('/app')
  expect(submitted).toEqual({ token: privateToken })
  expect(
    requested.some(
      (url) => url.includes('/billing/checkout') || url.includes(privateToken),
    ),
  ).toBe(false)
  const stored = await page.evaluate(() =>
    JSON.stringify({ ...localStorage, ...sessionStorage }),
  )
  expect(stored).not.toContain(privateToken)
})

test('platform access is never inferred from workspace ownership', async ({
  page,
}) => {
  await workspace(page)
  await page.route('**/admin/me', (route) =>
    route.fulfill({
      status: 403,
      json: {
        error: {
          code: 'PLATFORM_ACCESS_REQUIRED',
          message: 'Platform administrator access is required',
        },
      },
    }),
  )
  await page.goto('/admin')
  await expect(page.getByRole('alert')).toContainText(
    'PLATFORM_ACCESS_REQUIRED',
  )
  await expect(
    page.getByRole('button', { name: 'Approve application' }),
  ).toHaveCount(0)
})

for (const width of [375, 1440]) {
  test(`workspace has solid themed surfaces and fits ${width}px in both modes`, async ({
    page,
  }, testInfo) => {
    await workspace(page)
    await page.addInitScript(() => {
      if (!localStorage.getItem('theme')) localStorage.setItem('theme', 'light')
    })
    await page.setViewportSize({ width, height: 1000 })
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
    await page.goto('/app')
    await expect(
      page.getByRole('heading', { name: 'Good work starts here.' }),
    ).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width)
    const lightSurface = await page
      .locator('.panel')
      .first()
      .evaluate((node) => getComputedStyle(node).backgroundColor)
    await page.screenshot({
      path: testInfo.outputPath('workspace-light.png'),
      fullPage: true,
    })
    await page.getByRole('button', { name: 'Switch to dark mode' }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect
      .poll(() =>
        page
          .locator('.panel')
          .first()
          .evaluate((node) => getComputedStyle(node).backgroundColor),
      )
      .not.toBe(lightSurface)
    const backgrounds = await page
      .locator('*')
      .evaluateAll((nodes) =>
        nodes.map((node) => getComputedStyle(node).backgroundImage),
      )
    expect(backgrounds.some((value) => value.includes('gradient'))).toBe(false)
    await page.screenshot({
      path: testInfo.outputPath('workspace-dark.png'),
      fullPage: true,
    })
    await page.reload()
    await expect(
      page.getByRole('button', { name: 'Switch to light mode' }),
    ).toBeVisible()
  })
}
