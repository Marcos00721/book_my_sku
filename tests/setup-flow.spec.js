import { expect, test } from '@playwright/test'
import { makeSession, mockSignedIn } from './helpers/auth'
import { mockGeography } from './helpers/geography'

const applicationId = '507f1f77bcf86cd799439031'
const root = `/applications/${applicationId}/billing`
const completeSetup = {
  revision: 4,
  industry: 'Distributor',
  asiNumber: '',
  address: {
    line1: '1 Main Street',
    line2: '',
    city: 'Jaipur',
    country: 'IN',
    stateCode: 'IN-RJ',
    region: 'Rajasthan',
    postalCode: '302001',
  },
  complete: true,
  locked: false,
}
const offer = {
  state: 'awaiting_start',
  checkoutAllowed: false,
  offer: {
    revision: 3,
    currency: 'usd',
    interval: 'month',
    phases: [{ kind: 'standard', months: null, unitAmountMinor: 4900 }],
  },
  consent: {
    termsVersion: 'recurring-v2',
    termsUrl: 'https://example.com/terms',
  },
}
function journey(overrides = {}) {
  return {
    version: 1,
    actorId: '507f1f77bcf86cd799439099',
    observedAt: new Date().toISOString(),
    application: {
      id: applicationId,
      status: 'approved',
      mode: 'shared',
      companyName: 'Acme Promotions',
    },
    verification: { verified: true },
    registration: { phase: 'approved', recovery: null },
    setup: structuredClone(completeSetup),
    provisioning: null,
    billing: {
      flowVersion: 2,
      status: 'card_ready',
      quantity: 1,
      synchronization: 'current',
      startRequired: true,
      billingEligible: false,
    },
    offer: structuredClone(offer),
    platform: { ready: true, reason: null },
    workspaces: { items: [], next: null },
    invitations: { items: [], more: false },
    assisted: null,
    retryAfter: null,
    nextAction: 'prepare_workspace',
    ...overrides,
  }
}
async function mockFlow(page, initial, handle = async () => false, session) {
  await mockSignedIn(page, session)
  await mockGeography(page)
  const state = { current: initial, calls: [], fail: false }
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace('/api/v1', '')
    if (path.startsWith('/reference/')) return route.fallback()
    state.calls.push({
      path,
      method: request.method(),
      body: request.postDataJSON(),
    })
    const reply = (data) => route.fulfill({ json: { data } })
    if (path === '/onboarding/journey') {
      if (state.denied)
        return route.fulfill({
          status: 403,
          json: {
            error: {
              code: 'ACCOUNT_DISABLED',
              message: 'Account access is disabled.',
            },
          },
        })
      if (state.fail)
        return route.fulfill({
          status: 503,
          json: {
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Status temporarily unavailable.',
            },
          },
        })
      return reply(state.current)
    }
    if (await handle({ path, request, route, reply, state })) return
    if (path === '/onboarding/setup' && request.method() === 'GET')
      return reply(state.current.setup)
    return route.fulfill({
      status: 500,
      json: {
        error: {
          code: 'UNEXPECTED_REQUEST',
          message: 'Unexpected API call in setup regression.',
        },
      },
    })
  })
  return state
}

test('setup loads its current revision once and preserves entered company details when status refresh fails', async ({
  page,
}) => {
  const state = await mockFlow(
    page,
    journey({
      nextAction: 'complete_company',
      setup: { ...completeSetup, complete: false },
    }),
  )
  await page.goto('/setup')
  const industry = page.getByLabel('Industry', { exact: true })
  await expect(industry).toBeEnabled()
  expect(state.calls.map((call) => call.path)).toEqual([
    '/onboarding/journey',
    '/onboarding/setup',
  ])
  await industry.fill('My unsaved classification')
  state.fail = true
  await page
    .getByRole('button', { name: 'Check current status', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText(
    'Status temporarily unavailable',
  )
  await expect(industry).toHaveValue('My unsaved classification')
  expect(
    state.calls
      .filter((call) => call.method === 'GET')
      .map((call) => call.path),
  ).toEqual(['/onboarding/journey', '/onboarding/setup', '/onboarding/journey'])
})

test('workspace preparation and subscription start follow nextAction with separate explicit consent', async ({
  page,
}) => {
  const state = await mockFlow(
    page,
    journey(),
    async ({ path, request, reply, state }) => {
      if (path === '/onboarding/setup/prepare') {
        expect(request.postDataJSON()).toEqual({})
        state.current = journey({
          nextAction: 'review_and_start',
          provisioning: { status: 'prepared' },
          setup: { ...completeSetup, locked: true },
        })
        await reply({ status: 'prepared' })
        return true
      }
      if (path === `${root}/start`) {
        expect(request.postDataJSON()).toEqual({
          expectedOfferRevision: 3,
          recurringConsent: true,
          termsVersion: 'recurring-v2',
        })
        state.current = journey({
          nextAction: 'wait_billing',
          setup: { ...completeSetup, locked: true },
          provisioning: { status: 'prepared' },
          offer: { state: 'billing_started' },
        })
        await reply({ status: 'processing' })
        return true
      }
      return false
    },
  )
  await page.goto('/setup')
  await expect(
    page.getByRole('button', { name: 'Prepare workspace', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Start subscription', exact: true }),
  ).toHaveCount(0)
  expect(state.calls.filter((call) => call.method !== 'GET')).toHaveLength(0)
  await page
    .getByRole('button', { name: 'Prepare workspace', exact: true })
    .click()
  const start = page.getByRole('button', {
    name: 'Start subscription',
    exact: true,
  })
  await expect(start).toBeDisabled()
  await page
    .getByRole('checkbox', {
      name: /I explicitly agree to start recurring billing/,
    })
    .check()
  await start.click()
  await expect(
    page.getByRole('heading', {
      name: 'Your billing confirmation is processing',
      exact: true,
    }),
  ).toBeVisible()
  expect(
    state.calls
      .filter((call) => call.method === 'POST')
      .map((call) => call.path),
  ).toEqual(['/onboarding/setup/prepare', `${root}/start`])
  expect(
    state.calls.filter((call) => call.path === '/onboarding/journey'),
  ).toHaveLength(3)
  await expect(
    page.getByRole('button', { name: 'Activate workspace', exact: true }),
  ).toHaveCount(0)
})

test('waiting states poll reads with backoff and do not reconcile or activate another worker operation', async ({
  page,
}) => {
  await page.clock.install()
  const state = await mockFlow(page, journey({ nextAction: 'wait_billing' }))
  await page.goto('/setup?payment=success')
  await expect(
    page.getByRole('button', { name: 'Refresh billing status', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Prepare workspace', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Start subscription', exact: true }),
  ).toHaveCount(0)
  await page.clock.fastForward(64000)
  await expect.poll(() => state.calls.length).toBe(2)
  await page.clock.fastForward(60000)
  expect(state.calls).toHaveLength(2)
  expect(
    state.calls.every(
      (call) => call.path === '/onboarding/journey' && call.method === 'GET',
    ),
  ).toBe(true)
})

test('Finish uses the loaded setup revision, adopts the coordinator journey and never starts billing', async ({
  page,
}) => {
  const state = await mockFlow(
    page,
    journey({
      nextAction: 'complete_company',
      setup: { ...completeSetup, complete: false },
    }),
    async ({ path, request, reply, state }) => {
      if (path === '/onboarding/setup' && request.method() === 'PATCH') {
        const { expectedRevision, ...fields } = request.postDataJSON()
        expect(expectedRevision).toBe(4)
        state.current.setup = { ...state.current.setup, ...fields, revision: 5 }
        await reply(state.current.setup)
        return true
      }
      if (path === '/onboarding/setup/complete') {
        expect(request.postDataJSON()).toEqual({ expectedRevision: 5 })
        state.current = {
          ...state.current,
          nextAction: 'review_and_start',
          setup: { ...state.current.setup, complete: true, revision: 6 },
        }
        await reply(state.current.setup)
        return true
      }
      return false
    },
  )
  await page.goto('/setup')
  await page.getByLabel('Industry', { exact: true }).fill('Education')
  await page.getByRole('button', { name: 'Finish setup', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Start subscription', exact: true }),
  ).toBeDisabled()
  expect(
    state.calls.filter((call) => call.path === '/onboarding/journey'),
  ).toHaveLength(3)
  expect(
    state.calls.filter(
      (call) => call.path === '/onboarding/setup' && call.method === 'GET',
    ),
  ).toHaveLength(1)
  expect(
    state.calls.some((call) =>
      /checkout|billing\/start|setup\/prepare|onboarding\/activate/.test(
        call.path,
      ),
    ),
  ).toBe(false)
  await expect(
    page.getByRole('button', { name: 'Finish setup', exact: true }),
  ).toHaveCount(0)
})

test('a newer journey does not silently rebase a local company draft; conflicts require review', async ({
  page,
}) => {
  const state = await mockFlow(
    page,
    journey({
      nextAction: 'complete_company',
      setup: { ...completeSetup, complete: false },
    }),
    async ({ path, request, route, reply, state }) => {
      if (path === '/onboarding/setup' && request.method() === 'GET') {
        await reply(state.current.setup)
        return true
      }
      if (path === '/onboarding/setup' && request.method() === 'PATCH') {
        const { expectedRevision, ...fields } = request.postDataJSON()
        if (expectedRevision !== state.current.setup.revision)
          await route.fulfill({
            status: 409,
            json: {
              error: {
                code: 'SETUP_CHANGED',
                message: 'Review the newer company details.',
              },
            },
          })
        else {
          state.current.setup = {
            ...state.current.setup,
            ...fields,
            revision: expectedRevision + 1,
          }
          await reply(state.current.setup)
        }
        return true
      }
      return false
    },
  )
  await page.goto('/setup')
  const industry = page.getByLabel('Industry', { exact: true })
  await industry.fill('My local company draft')
  state.current.setup = {
    ...state.current.setup,
    revision: 5,
    industry: 'Another tab value',
  }
  await page
    .getByRole('button', { name: 'Check current status', exact: true })
    .click()
  await expect(industry).toHaveValue('My local company draft')
  await page
    .getByRole('button', { name: 'Save company details', exact: true })
    .click()
  const review = page.getByRole('region', {
    name: 'Review conflicting changes',
  })
  await expect(review).toContainText('Another tab value')
  expect(
    state.calls.find((call) => call.method === 'PATCH').body.expectedRevision,
  ).toBe(4)
  await review
    .getByRole('button', { name: 'Use current revision and keep my edits' })
    .click()
  await page
    .getByRole('button', { name: 'Save company details', exact: true })
    .click()
  await expect
    .poll(() => state.current.setup.industry)
    .toBe('My local company draft')
  expect(
    state.calls.filter((call) => call.method === 'PATCH').at(-1).body
      .expectedRevision,
  ).toBe(5)
})

test('an existing member goes to the workspace without owner onboarding or billing reads', async ({
  page,
}) => {
  const state = await mockFlow(
    page,
    journey({
      nextAction: 'open_workspace',
      setup: null,
      application: null,
      billing: null,
      offer: null,
    }),
    async ({ path, reply }) => {
      if (path === '/organizations') {
        await reply({ items: [], next: null })
        return true
      }
      return false
    },
  )
  await page.goto('/setup')
  await expect(page).toHaveURL('/app')
  expect(
    state.calls.some((call) =>
      /onboarding\/me|onboarding\/setup|\/billing|assisted/.test(call.path),
    ),
  ).toBe(false)
})

test('an authorization failure clears the old company snapshot and payment controls', async ({
  page,
}) => {
  const state = await mockFlow(
    page,
    journey({
      nextAction: 'complete_company',
      setup: { ...completeSetup, complete: false },
    }),
  )
  await page.goto('/setup')
  await expect(page.getByLabel('Industry', { exact: true })).toBeEnabled()
  state.denied = true
  await page
    .getByRole('button', { name: 'Check current status', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText('ACCOUNT_DISABLED')
  await expect(page.getByLabel('Industry', { exact: true })).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Start subscription', exact: true }),
  ).toHaveCount(0)
  expect(state.calls.every((call) => call.method === 'GET')).toBe(true)
})

test('activation requires an explicit eligible nextAction and refreshes the existing workspace', async ({
  page,
}) => {
  const state = await mockFlow(
    page,
    journey({
      nextAction: 'activate_workspace',
      billing: {
        flowVersion: 1,
        status: 'active',
        billingEligible: true,
        quantity: 1,
      },
      offer: { state: 'billing_started' },
      setup: { ...completeSetup, locked: true },
    }),
    async ({ path, request, reply, state }) => {
      if (path === '/onboarding/activate') {
        expect(request.postDataJSON()).toEqual({})
        state.current = journey({ nextAction: 'open_workspace', setup: null })
        await reply({ status: 'active' })
        return true
      }
      if (path === '/organizations') {
        await reply({ items: [], next: null })
        return true
      }
      return false
    },
  )
  await page.goto('/setup')
  const activate = page.getByRole('button', {
    name: 'Activate workspace',
    exact: true,
  })
  await expect(activate).toBeVisible()
  expect(state.calls.some((call) => call.method === 'POST')).toBe(false)
  await activate.click()
  await expect(page).toHaveURL('/app')
  expect(
    state.calls
      .filter((call) => call.method === 'POST')
      .map((call) => call.path),
  ).toEqual(['/onboarding/activate'])
})

test('a provisioning lock preserves the local draft and stops autosave and Finish', async ({
  page,
}) => {
  await page.clock.install()
  const state = await mockFlow(
    page,
    journey({
      nextAction: 'complete_company',
      setup: { ...completeSetup, complete: false },
    }),
  )
  await page.goto('/setup')
  const industry = page.getByLabel('Industry', { exact: true })
  await industry.fill('Keep this draft for review')
  state.current = journey({
    nextAction: 'wait_provisioning',
    setup: { ...completeSetup, locked: true },
    provisioning: { status: 'pending', provisioning: { state: 'in_progress' } },
  })
  await page
    .getByRole('button', { name: 'Check current status', exact: true })
    .click()
  await expect(industry).toHaveValue('Keep this draft for review')
  await expect(industry).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Finish setup', exact: true }),
  ).toBeDisabled()
  await page.clock.fastForward(2000)
  expect(state.calls.filter((call) => call.method !== 'GET')).toHaveLength(0)
})

test('an interrupted Finish can resume a committed completion without editing or completing again', async ({
  page,
}) => {
  const state = await mockFlow(
    page,
    journey({
      nextAction: 'complete_company',
      setup: { ...completeSetup, complete: false },
    }),
    async ({ path, request, reply, state }) => {
      if (path === '/onboarding/setup/complete') {
        expect(request.postDataJSON()).toEqual({ expectedRevision: 4 })
        state.current = journey({
          nextAction: 'review_and_start',
          setup: { ...completeSetup, complete: true, revision: 5 },
        })
        state.fail = true
        await reply(state.current.setup)
        return true
      }
      return false
    },
  )
  await page.goto('/setup')
  await page.getByRole('button', { name: 'Finish setup', exact: true }).click()
  const retry = page.getByRole('button', {
    name: 'Retry completion',
    exact: true,
  })
  await expect(retry).toBeEnabled()
  state.fail = false
  await retry.click()
  await expect(
    page.getByRole('button', { name: 'Start subscription', exact: true }),
  ).toBeDisabled()
  expect(
    state.calls.filter((call) => call.path === '/onboarding/setup/complete'),
  ).toHaveLength(1)
  expect(
    state.calls
      .filter((call) => call.method !== 'GET')
      .map((call) => call.path),
  ).toEqual(['/onboarding/setup/complete'])
})

test('a prepared workspace with pending Checkout offers delayed recovery of the original session', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-11-05T10:00:00Z') })
  const state = await mockFlow(
    page,
    journey({
      nextAction: 'wait_billing',
      setup: { ...completeSetup, locked: true },
      provisioning: { status: 'prepared', provisioning: { state: 'prepared' } },
      billing: {
        flowVersion: 2,
        status: 'checkout_creating',
        synchronization: 'pending',
        revision: 2,
        quantity: 1,
      },
      offer: { state: 'billing_started', checkoutAllowed: false },
      retryAfter: '2026-11-05T10:03:00Z',
    }),
    async ({ path, request, reply, state }) => {
      if (path === `${root}/recovery`) {
        expect(request.postDataJSON()).toEqual({})
        state.current = {
          ...state.current,
          nextAction: 'recover_payment',
          retryAfter: null,
          billing: {
            ...state.current.billing,
            status: 'checkout_pending',
            synchronization: 'current',
            revision: 3,
          },
        }
        await reply({
          state: 'payment_required',
          nextAction: 'open_payment_page',
          reason: 'card_setup_required',
          paymentUrl: 'https://checkout.stripe.com/c/pay/original-session',
        })
        return true
      }
      return false
    },
  )
  await page.goto('/setup')
  await expect(
    page.getByRole('heading', {
      name: 'Your secure card setup is being prepared',
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    page.getByText(
      'Your company details are saved and locked. Your workspace is prepared; complete the card and billing steps below.',
      { exact: true },
    ),
  ).toBeVisible()
  const resume = page.getByRole('button', {
    name: 'Resume existing Checkout',
    exact: true,
  })
  await expect(resume).toBeDisabled()
  await page.screenshot({
    path: 'test-results/setup-checkout-pending.png',
    fullPage: true,
  })
  await page.clock.fastForward(121000)
  await expect(resume).toBeDisabled()
  expect(state.calls.filter((call) => call.method === 'POST')).toHaveLength(0)
  await page.clock.fastForward(64000)
  await expect(resume).toBeEnabled()
  await resume.click()
  await expect(
    page.getByRole('link', { name: 'Continue secure payment' }),
  ).toHaveAttribute(
    'href',
    'https://checkout.stripe.com/c/pay/original-session',
  )
  expect(
    state.calls
      .filter((call) => call.method === 'POST')
      .map((call) => call.path),
  ).toEqual([`${root}/recovery`])
  expect(
    await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    ),
  ).not.toContain('original-session')
})

test('pending recovery honors HTTP retry timing and never creates a replacement Checkout', async ({
  page,
}) => {
  await page.clock.install()
  const state = await mockFlow(
    page,
    journey({
      nextAction: 'wait_billing',
      setup: { ...completeSetup, locked: true },
      provisioning: { status: 'prepared' },
      billing: {
        flowVersion: 2,
        status: 'checkout_creating',
        synchronization: 'pending',
        quantity: 1,
      },
      offer: { state: 'billing_started' },
    }),
    async ({ path, route }) => {
      if (path === `${root}/recovery`) {
        await route.fulfill({
          status: 503,
          headers: { 'Retry-After': '400' },
          json: {
            error: {
              code: 'BILLING_RETRY_REQUIRED',
              message: 'The existing request is still processing.',
            },
          },
        })
        return true
      }
      return false
    },
  )
  await page.goto('/setup')
  const resume = page.getByRole('button', {
    name: 'Resume existing Checkout',
    exact: true,
  })
  await expect(resume).toBeDisabled()
  await page.clock.fastForward(124000)
  await expect(resume).toBeEnabled()
  await resume.click()
  await expect(page.getByRole('alert')).toContainText('BILLING_RETRY_REQUIRED')
  await page.clock.fastForward(125000)
  await expect(resume).toBeDisabled()
  await page.clock.fastForward(280000)
  await expect(resume).toBeEnabled()
  expect(
    state.calls
      .filter((call) => call.method === 'POST')
      .map((call) => call.path),
  ).toEqual([`${root}/recovery`])
})

test('saved-card consent resets on an offer update before explicit start and activation', async ({
  page,
}) => {
  const state = await mockFlow(
    page,
    journey({
      nextAction: 'review_and_start',
      setup: { ...completeSetup, locked: true },
      provisioning: { status: 'prepared' },
    }),
    async ({ path, request, reply, state }) => {
      if (path === `${root}/start`) {
        expect(request.postDataJSON()).toEqual({
          expectedOfferRevision: 4,
          recurringConsent: true,
          termsVersion: 'recurring-v3',
        })
        state.current = {
          ...state.current,
          nextAction: 'wait_billing',
          billing: {
            ...state.current.billing,
            status: 'start_pending',
            synchronization: 'pending',
          },
          offer: { state: 'billing_started' },
        }
        await reply(state.current.billing)
        return true
      }
      if (path === '/onboarding/activate') {
        state.current = {
          ...state.current,
          nextAction: 'open_workspace',
          setup: null,
        }
        await reply({ status: 'active' })
        return true
      }
      if (path === '/organizations') {
        await reply({ items: [], next: null })
        return true
      }
      return false
    },
  )
  await page.goto('/setup')
  const consent = page.getByRole('checkbox', {
    name: /I explicitly agree to start recurring billing/,
  })
  await expect(
    page.getByRole('link', { name: 'Read recurring terms', exact: true }),
  ).toHaveAttribute('href', 'https://example.com/terms')
  await consent.check()
  state.current = {
    ...state.current,
    offer: {
      ...offer,
      offer: { ...offer.offer, revision: 4 },
      consent: { ...offer.consent, termsVersion: 'recurring-v3' },
    },
  }
  await page
    .getByRole('button', { name: 'Check current status', exact: true })
    .click()
  await expect(consent).not.toBeChecked()
  const start = page.getByRole('button', {
    name: 'Start subscription',
    exact: true,
  })
  await expect(start).toBeDisabled()
  expect(state.calls.filter((call) => call.method === 'POST')).toHaveLength(0)
  await consent.check()
  await start.click()
  await expect(
    page.getByRole('heading', {
      name: 'Your billing confirmation is processing',
      exact: true,
    }),
  ).toBeVisible()
  state.current = {
    ...state.current,
    nextAction: 'activate_workspace',
    billing: {
      ...state.current.billing,
      status: 'active',
      synchronization: 'current',
      billingEligible: true,
    },
  }
  await page
    .getByRole('button', { name: 'Check current status', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Activate workspace', exact: true })
    .click()
  await expect(page).toHaveURL('/app')
  expect(
    state.calls
      .filter((call) => call.method === 'POST')
      .map((call) => call.path),
  ).toEqual([`${root}/start`, '/onboarding/activate'])
})

test('automatic checks stop at their budget and a manual check restarts bounded polling', async ({
  page,
}) => {
  await page.clock.install()
  const state = await mockFlow(
    page,
    journey({
      nextAction: 'wait_billing',
      setup: { ...completeSetup, locked: true },
      billing: {
        flowVersion: 2,
        status: 'start_pending',
        synchronization: 'pending',
      },
      offer: { state: 'billing_started' },
    }),
    undefined,
    // The bounded polling window exceeds the ordinary 15-minute test session.
    // Keep identity valid while the fake clock exercises that window.
    {
      ...makeSession(),
      expires_in: 7200,
      expires_at: Math.floor(Date.now() / 1000) + 7200,
    },
  )
  await page.goto('/setup')
  await expect(
    page.getByRole('heading', {
      name: 'Your billing confirmation is processing',
      exact: true,
    }),
  ).toBeVisible()
  const seats = page
    .getByText('Paid seats', { exact: true })
    .locator('..')
    .locator('dd')
  const waitForPollOwner = () =>
    expect
      .poll(() =>
        page.evaluate(async () => {
          const locks = await navigator.locks.query()
          return locks.held.some((lock) =>
            lock.name.startsWith('bookmysku:journey:'),
          )
        }),
      )
      .toBe(true)
  await waitForPollOwner()
  for (const [index, delay] of [
    64000, 124000, 244000, 304000, 304000, 304000,
  ].entries()) {
    state.current = {
      ...state.current,
      billing: { ...state.current.billing, quantity: index + 2 },
    }
    await page.clock.fastForward(delay)
    await expect.poll(() => state.calls.length).toBe(index + 2)
    // Wait for the response to render before advancing the next timer.
    await expect(seats).toHaveText(String(index + 2))
    if (index < 5) await waitForPollOwner()
  }
  await expect(
    page.getByText(/Automatic checks have paused after several attempts/),
  ).toBeVisible()
  await page.clock.fastForward(600000)
  expect(state.calls).toHaveLength(7)
  state.current = {
    ...state.current,
    billing: { ...state.current.billing, quantity: 8 },
  }
  await page
    .getByRole('button', { name: 'Check current status', exact: true })
    .click()
  await expect.poll(() => state.calls.length).toBe(8)
  await expect(seats).toHaveText('8')
  await waitForPollOwner()
  await page.clock.fastForward(64000)
  await expect.poll(() => state.calls.length).toBe(9)
  expect(state.calls.every((call) => call.method === 'GET')).toBe(true)
})

test('recovery never renders an unverified provider payment URL', async ({
  page,
}) => {
  await page.clock.install()
  const state = await mockFlow(
    page,
    journey({
      nextAction: 'wait_billing',
      setup: { ...completeSetup, locked: true },
      billing: {
        flowVersion: 2,
        status: 'checkout_creating',
        synchronization: 'pending',
      },
      offer: { state: 'billing_started' },
    }),
    async ({ path, reply }) => {
      if (path === `${root}/recovery`) {
        await reply({
          state: 'payment_required',
          nextAction: 'open_payment_page',
          paymentUrl: 'https://checkout.stripe.com.attacker.example/pay',
        })
        return true
      }
      return false
    },
  )
  await page.goto('/setup')
  const resume = page.getByRole('button', {
    name: 'Resume existing Checkout',
    exact: true,
  })
  await expect(resume).toBeDisabled()
  await page.clock.fastForward(124000)
  await expect(resume).toBeEnabled()
  await resume.click()
  await expect(page.getByRole('alert')).toContainText(
    'payment link could not be verified',
  )
  await expect(
    page.getByRole('link', { name: 'Continue secure payment' }),
  ).toHaveCount(0)
  expect(
    state.calls
      .filter((call) => call.method === 'POST')
      .map((call) => call.path),
  ).toEqual([`${root}/recovery`])
})

test('two tabs for the same account share one automatic journey poll owner', async ({
  page,
}) => {
  const time = new Date('2026-11-05T10:00:00Z')
  const pending = journey({
    nextAction: 'wait_billing',
    setup: { ...completeSetup, locked: true },
    billing: {
      flowVersion: 2,
      status: 'start_pending',
      synchronization: 'pending',
    },
    offer: { state: 'billing_started' },
  })
  await page.clock.install({ time })
  const first = await mockFlow(page, structuredClone(pending))
  await page.goto('/setup')
  await expect
    .poll(() =>
      page.evaluate(async () =>
        (await navigator.locks.query()).held.some((lock) =>
          lock.name.startsWith('bookmysku:journey:'),
        ),
      ),
    )
    .toBe(true)
  const secondPage = await page.context().newPage()
  await secondPage.clock.install({ time })
  const second = await mockFlow(secondPage, structuredClone(pending))
  await secondPage.goto('/setup')
  await expect(
    secondPage.getByRole('heading', {
      name: 'Your billing confirmation is processing',
      exact: true,
    }),
  ).toBeVisible()
  await secondPage.clock.fastForward(64000)
  expect(second.calls).toHaveLength(1)
  await page.clock.fastForward(64000)
  await expect.poll(() => first.calls.length).toBe(2)
  expect(second.calls).toHaveLength(1)
  expect(
    [...first.calls, ...second.calls].every((call) => call.method === 'GET'),
  ).toBe(true)
  await secondPage.close()
})
