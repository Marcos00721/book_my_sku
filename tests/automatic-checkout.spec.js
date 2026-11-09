import { expect, test } from '@playwright/test'
import { mockSignedIn } from './helpers/auth'
import { mockGeography } from './helpers/geography'

const applicationId = '507f1f77bcf86cd799439031'
const billing = `/applications/${applicationId}/billing`
const stripeUrl = 'https://checkout.stripe.com/c/pay/automatic-original'
async function setup(page, handle = async () => false) {
  await mockSignedIn(page)
  await mockGeography(page)
  const model = {
    calls: [],
    setup: {
      revision: 8,
      complete: false,
      locked: false,
      industry: 'Distributor',
      asiNumber: '',
      address: {
        line1: '1 Main Street',
        line2: '',
        city: 'Jaipur',
        country: 'IN',
        stateCode: 'IN-RJ',
        postalCode: '302001',
      },
    },
    snapshot: {
      actorId: '507f1f77bcf86cd799439099',
      nextAction: 'complete_company',
      application: { id: applicationId, status: 'approved', mode: 'shared' },
      platform: { ready: true },
      provisioning: null,
      billing: {
        flowVersion: 2,
        status: 'not_started',
        quantity: 1,
        synchronization: 'current',
      },
      offer: {
        state: 'available',
        checkoutAllowed: true,
        initialQuantity: 1,
        taxes: 'not_enabled',
        offer: {
          revision: 3,
          currency: 'usd',
          interval: 'month',
          phases: [
            { kind: 'trial', months: 1, unitAmountMinor: 0 },
            { kind: 'standard', months: null, unitAmountMinor: 4900 },
          ],
        },
        consent: {
          termsVersion: 'recurring-v2',
          termsUrl: 'https://example.com/terms',
        },
      },
      workspaces: { items: [], next: null },
      invitations: { items: [], more: false },
      retryAfter: null,
    },
  }
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
  await page.route('https://checkout.stripe.com/**', (route) => {
    expect(route.request().headers().authorization).toBeUndefined()
    return route.fulfill({
      contentType: 'text/html',
      body: '<h1>Stripe card setup</h1>',
    })
  })
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace('/api/v1', '')
    if (path.startsWith('/reference/')) return route.fallback()
    model.calls.push({
      path,
      method: request.method(),
      body: request.postDataJSON(),
      key: request.headers()['idempotency-key'],
    })
    const reply = (data) => route.fulfill({ json: { data } })
    if (await handle({ path, request, reply, route, model })) return
    if (path === '/onboarding/journey')
      return reply({ ...model.snapshot, setup: model.setup })
    if (path === '/onboarding/setup' && request.method() === 'GET')
      return reply(model.setup)
    if (path === '/onboarding/setup' && request.method() === 'PATCH') {
      const { expectedRevision, ...fields } = request.postDataJSON()
      expect(expectedRevision).toBe(model.setup.revision)
      model.setup = {
        ...model.setup,
        ...fields,
        revision: model.setup.revision + 1,
        complete: false,
      }
      return reply(model.setup)
    }
    if (path === '/onboarding/setup/complete') {
      expect(request.postDataJSON()).toEqual({
        expectedRevision: model.setup.revision,
      })
      model.setup = {
        ...model.setup,
        complete: true,
        revision: model.setup.revision + 1,
      }
      model.snapshot.nextAction = 'prepare_workspace'
      return reply(model.setup)
    }
    if (path === '/onboarding/setup/prepare') {
      model.setup.locked = true
      model.snapshot.provisioning = { status: 'prepared' }
      model.snapshot.nextAction =
        model.snapshot.billing.status === 'checkout_creating'
          ? 'wait_billing'
          : model.snapshot.billing.status === 'checkout_pending'
            ? 'recover_payment'
            : 'review_offer'
      return reply({ status: 'prepared' })
    }
    if (path === `${billing}/checkout`) {
      model.snapshot.billing = {
        ...model.snapshot.billing,
        status: 'checkout_pending',
      }
      model.snapshot.offer = { state: 'billing_started' }
      model.snapshot.nextAction = 'recover_payment'
      return reply({ checkoutUrl: stripeUrl })
    }
    if (path === `${billing}/recovery`)
      return reply({
        state: 'payment_required',
        nextAction: 'open_payment_page',
        paymentUrl: stripeUrl,
      })
    return route.fulfill({
      status: 500,
      json: { error: { code: 'UNEXPECTED_REQUEST' } },
    })
  })
  return model
}

async function advanceToPaymentStep(page) {
  const continueBtn = page.getByRole('button', {
    name: /^(Save and )?Continue to payment$/,
    exact: true,
  })
  await continueBtn.click()
  await expect(
    page.getByRole('checkbox', { name: /I agree to recurring billing/ }),
  ).toBeVisible()
}

async function acceptAndFinish(page) {
  await advanceToPaymentStep(page)
  await page
    .getByRole('checkbox', { name: /I agree to recurring billing/ })
    .check()
  await page
    .getByRole('button', {
      name: 'Finish setup and continue to payment',
      exact: true,
    })
    .click()
}

test('Finish opens Stripe automatically after completion and current offer consent; save alone never opens payment', async ({
  page,
}) => {
  const model = await setup(page)
  await page.goto('/setup')
  await expect(
    page.getByRole('textbox', { name: 'Industry', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', {
      name: /^(Save and )?Continue to payment$/,
      exact: true,
    }),
  ).toBeEnabled()
  await expect(
    page.getByRole('checkbox', { name: /I agree to recurring billing/ }),
  ).toHaveCount(0)
  await page
    .getByRole('textbox', { name: 'Industry', exact: true })
    .fill('Education')
  await page.getByRole('button', { name: 'Save company details' }).click()
  await expect(
    page.getByText('Saved revision 9', { exact: true }),
  ).toBeVisible()
  expect(
    model.calls.filter((call) => call.path.startsWith(billing)),
  ).toHaveLength(0)
  await expect(page).toHaveURL('/setup')
  await acceptAndFinish(page)
  await expect(page).toHaveURL(stripeUrl)
  const checkout = model.calls.filter(
    (call) => call.path === `${billing}/checkout`,
  )
  expect(checkout).toHaveLength(1)
  expect(checkout[0].body).toEqual({
    expectedOfferRevision: 3,
    recurringConsent: true,
    termsVersion: 'recurring-v2',
  })
  expect(checkout[0].key).toMatch(/^[a-f\d-]{36}$/)
  expect(model.calls.some((call) => call.path === `${billing}/start`)).toBe(
    false,
  )
  expect(
    model.calls.findIndex((call) => call.path === '/onboarding/setup/complete'),
  ).toBeLessThan(
    model.calls.findIndex((call) => call.path === `${billing}/checkout`),
  )
})

test('failed company completion preserves the form and never opens Checkout', async ({
  page,
}) => {
  const model = await setup(page, async ({ path, route }) => {
    if (path !== '/onboarding/setup/complete') return false
    await route.fulfill({
      status: 409,
      json: {
        error: {
          code: 'SETUP_INCOMPLETE',
          message: 'Company details require review.',
          fields: [
            {
              field: 'address.stateCode',
              message: 'Choose the current state.',
            },
          ],
        },
      },
    })
    return true
  })
  await page.goto('/setup')
  await acceptAndFinish(page)
  await expect(page.getByRole('alert').first()).toContainText(
    'Company details require review.',
  )
  await expect(
    page.getByRole('textbox', { name: 'Industry', exact: true }),
  ).toHaveValue('Distributor')
  expect(model.calls.some((call) => call.path.startsWith(billing))).toBe(false)
  await expect(page).toHaveURL('/setup')
})

test('an offer changed during preparation requires fresh consent instead of automatic Checkout', async ({
  page,
}) => {
  const model = await setup(page, async ({ path, model }) => {
    if (path === '/onboarding/setup/prepare')
      model.snapshot.offer = {
        ...model.snapshot.offer,
        offer: { ...model.snapshot.offer.offer, revision: 4 },
        consent: {
          ...model.snapshot.offer.consent,
          termsVersion: 'recurring-v3',
        },
      }
    return false
  })
  await page.goto('/setup')
  await acceptAndFinish(page)
  await expect(page.getByRole('alert')).toContainText('OFFER_REVISION_CONFLICT')
  await expect(
    page.getByRole('checkbox', { name: /I agree to recurring billing/ }),
  ).not.toBeChecked()
  expect(
    model.calls.filter((call) => call.path === `${billing}/checkout`),
  ).toHaveLength(0)
  await expect(page).toHaveURL('/setup')
})

test('uncertain automatic Checkout retries its original body and key without completing company setup again', async ({
  page,
}) => {
  let attempts = 0
  const model = await setup(page, async ({ path, route }) => {
    if (path !== `${billing}/checkout` || ++attempts !== 1) return false
    await route.fulfill({
      status: 503,
      json: {
        error: {
          code: 'BILLING_RETRY_REQUIRED',
          message: 'The Checkout response was interrupted.',
        },
      },
    })
    return true
  })
  await page.goto('/setup')
  await acceptAndFinish(page)
  await expect(page.getByRole('alert')).toContainText(
    'The Checkout response was interrupted.',
  )
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page).toHaveURL(stripeUrl)
  const checkouts = model.calls.filter(
    (call) => call.path === `${billing}/checkout`,
  )
  expect(checkouts).toHaveLength(2)
  expect(checkouts[0]).toEqual(checkouts[1])
  expect(
    model.calls.filter((call) => call.path === '/onboarding/setup/complete'),
  ).toHaveLength(1)
})

test('Finish automatically recovers the original pending Checkout after its waiting period', async ({
  page,
}) => {
  await page.clock.install()
  const model = await setup(page)
  model.snapshot.billing = {
    ...model.snapshot.billing,
    status: 'checkout_creating',
    synchronization: 'pending',
  }
  model.snapshot.offer = { state: 'billing_started' }
  await page.goto('/setup')
  await page
    .getByRole('button', {
      name: 'Finish setup and continue to payment',
      exact: true,
    })
    .click()
  await expect(
    page.getByRole('region', {
      name: 'Continue to secure payment',
      exact: true,
    }),
  ).toBeVisible()
  expect(
    model.calls.filter((call) => call.path.startsWith(billing)),
  ).toHaveLength(0)
  await page.clock.fastForward(124000)
  await expect(page).toHaveURL(stripeUrl)
  expect(
    model.calls.filter((call) => call.path === `${billing}/checkout`),
  ).toHaveLength(0)
  expect(
    model.calls.filter((call) => call.path === `${billing}/recovery`),
  ).toHaveLength(1)
  expect(model.calls.some((call) => call.path === `${billing}/start`)).toBe(
    false,
  )
})

test('reloading completed details never invents consent or redirects from a success flag', async ({
  page,
}) => {
  const model = await setup(page)
  model.setup = { ...model.setup, complete: true, locked: true }
  model.snapshot.nextAction = 'review_offer'
  await page.goto('/setup?payment=success')
  await page
    .getByRole('button', { name: 'Continue to workspace', exact: true })
    .click()
  await expect(
    page.getByRole('button', {
      name: 'Continue to secure Checkout',
      exact: true,
    }),
  ).toBeDisabled()
  expect(model.calls.every((call) => call.method === 'GET')).toBe(true)
  await expect(page).toHaveURL('/setup?payment=success')
})

test('automatic payment rejects unsafe provider destinations', async ({
  page,
}) => {
  const model = await setup(page, async ({ path, reply, model }) => {
    if (path !== `${billing}/checkout`) return false
    model.snapshot.billing = {
      ...model.snapshot.billing,
      status: 'checkout_pending',
    }
    model.snapshot.offer = { state: 'billing_started' }
    model.snapshot.nextAction = 'recover_payment'
    await reply({
      checkoutUrl: 'https://checkout.stripe.com.attacker.example/pay',
    })
    return true
  })
  await page.goto('/setup')
  await acceptAndFinish(page)
  await expect(page.getByRole('alert')).toContainText('INVALID_PAYMENT_URL')
  expect(
    model.calls.filter((call) => call.path === `${billing}/checkout`),
  ).toHaveLength(1)
  await expect(page).toHaveURL('/setup')
})
