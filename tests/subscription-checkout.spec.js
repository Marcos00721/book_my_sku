import { expect, test } from '@playwright/test'
import { mockSignedIn } from './helpers/auth'
import { mockGeography } from './helpers/geography'

const id = '507f1f77bcf86cd799439031'
const billing = `/applications/${id}/billing`
const stripeUrl = 'https://checkout.stripe.com/c/pay/subscription-original'

async function setup(page, { trial = 0, complete = true, handle = async () => false } = {}) {
  await mockSignedIn(page)
  await mockGeography(page)
  const state = {
    calls: [],
    current: {
      actorId: '507f1f77bcf86cd799439099',
      nextAction: complete ? 'review_offer' : 'complete_company',
      application: { id, status: 'approved', mode: 'shared' },
      platform: { ready: true },
      setup: {
        revision: 4, complete, locked: complete, industry: 'Distributor',
        address: { line1: '1 Main Street', line2: '', city: 'Jaipur', postalCode: '302001', country: 'IN', stateCode: 'IN-RJ' },
      },
      provisioning: complete ? { status: 'prepared' } : null,
      billing: { flowVersion: 4, status: 'not_started', billingEligible: false, synchronization: 'current', quantity: 1 },
      offer: {
        flowVersion: 4, checkoutMode: 'subscription', state: 'available', checkoutAllowed: true,
        initialQuantity: 1, taxes: 'not_enabled',
        offer: { revision: 3, currency: 'usd', interval: 'month', phases: [
          ...(trial ? [{ kind: 'trial', months: trial, unitAmountMinor: 0 }] : []),
          { kind: 'discount', months: 2, unitAmountMinor: 2450 },
          { kind: 'standard', months: null, unitAmountMinor: 4900 },
        ] },
        firstCharge: { amountMinor: 2450, currency: 'usd', quantity: 1, trialMonths: trial, estimatedAt: '2026-12-15T00:00:00Z', timing: 'relative_to_checkout_completion' },
        consent: { termsVersion: 'recurring-v2', termsUrl: 'https://example.com/terms' },
      },
      invitations: { items: [] }, workspaces: { items: [], next: null },
    },
  }
  await page.route('https://fonts.googleapis.com/**', route => route.abort())
  await page.route('https://fonts.gstatic.com/**', route => route.abort())
  await page.route('https://checkout.stripe.com/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Subscription Checkout</h1>' }))
  await page.route('**/api/v1/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace('/api/v1', '')
    if (path.startsWith('/reference/')) return route.fallback()
    state.calls.push({ path, method: request.method(), body: request.postDataJSON(), key: request.headers()['idempotency-key'] })
    const reply = data => route.fulfill({ json: { data } })
    if (await handle({ path, request, route, reply, state })) return
    if (path === '/onboarding/journey') return reply(state.current)
    if (path === '/onboarding/setup' && request.method() === 'GET') return reply(state.current.setup)
    if (path === `${billing}/checkout`) return reply({ status: 'checkout_pending', checkoutUrl: stripeUrl })
    if (path === `${billing}/refresh`) return reply(state.current.billing)
    return route.fulfill({ status: 500, json: { error: { code: 'UNEXPECTED_REQUEST', message: `Unexpected ${path}` } } })
  })
  return state
}

for (const trial of [0, 1]) {
  test(`flow 4 ${trial ? 'trial' : 'paid offer'} needs explicit consent and one subscription Checkout`, async ({ page }) => {
    const state = await setup(page, { trial })
    await page.goto('/setup')
    const pay = page.getByRole('button', { name: trial ? 'Start trial' : 'Pay and subscribe', exact: true })
    await expect(pay).toBeDisabled()
    await expect(page.getByLabel('First charge estimate')).toContainText('$24.50')
    if (trial) await expect(page.getByLabel('First charge estimate')).toContainText('actual charge date depends on when you complete it')
    await expect(page.getByRole('button', { name: /^(Prepare workspace|Activate workspace|Start subscription)$/ })).toHaveCount(0)
    expect(state.calls.filter(call => call.method !== 'GET')).toEqual([])
    await page.getByRole('checkbox', { name: /I agree to recurring billing/ }).check()
    await pay.click()
    await expect(page).toHaveURL(stripeUrl)
    const writes = state.calls.filter(call => call.method !== 'GET')
    expect(writes).toHaveLength(1)
    expect(writes[0]).toMatchObject({ path: `${billing}/checkout`, body: { expectedOfferRevision: 3, recurringConsent: true, termsVersion: 'recurring-v2' } })
    expect(writes[0].key).toMatch(/^[\da-f-]{36}$/)
  })
}

test('company completion waits for automatic preparation, then requests fresh payment consent', async ({ page }) => {
  const state = await setup(page, { complete: false, handle: async ({ path, reply, state }) => {
    if (path !== '/onboarding/setup/complete') return false
    state.current.setup = { ...state.current.setup, complete: true, locked: true, revision: 5 }
    state.current.billing.status = 'preparing'
    state.current.offer = { state: 'preparing', checkoutAllowed: false, checkoutMode: 'subscription' }
    state.current.nextAction = 'wait_provisioning'
    await reply(state.current.setup)
    return true
  } })
  const preparedOffer = structuredClone(state.current.offer)
  await page.goto('/setup')
  await expect(page.getByRole('button', { name: 'Pay and subscribe', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Finish setup', exact: true }).click()
  await expect(page.getByText('Your workspace is being prepared automatically.', { exact: false })).toBeVisible()
  expect(state.calls.filter(call => call.method !== 'GET').map(call => call.path)).toEqual(['/onboarding/setup/complete'])
  state.current.offer = preparedOffer
  state.current.billing.status = 'not_started'
  state.current.provisioning = { status: 'prepared' }
  state.current.nextAction = 'review_offer'
  await page.getByRole('button', { name: 'Check current status', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pay and subscribe', exact: true })).toBeDisabled()
  expect(state.calls.filter(call => call.path.endsWith('/checkout'))).toEqual([])
})

test('uncertain subscription Checkout preserves the exact body and UUID', async ({ page }) => {
  let attempts = 0
  const state = await setup(page, { handle: async ({ path, route }) => {
    if (path !== `${billing}/checkout` || ++attempts > 1) return false
    await route.abort('failed')
    return true
  } })
  await page.goto('/setup')
  await page.getByRole('checkbox', { name: /I agree to recurring billing/ }).check()
  await page.getByRole('button', { name: 'Pay and subscribe', exact: true }).click()
  await page.getByRole('button', { name: 'Retry same Checkout', exact: true }).click()
  await expect(page).toHaveURL(stripeUrl)
  const writes = state.calls.filter(call => call.path === `${billing}/checkout`)
  expect(writes).toHaveLength(2)
  expect(writes[1]).toEqual(writes[0])
})

test('changed subscription offer needs new consent and uses the new revision', async ({ page }) => {
  let attempts = 0
  const state = await setup(page, { handle: async ({ path, route, state }) => {
    if (path !== `${billing}/checkout` || ++attempts > 1) return false
    state.current.offer.offer.revision = 4
    state.current.offer.consent.termsVersion = 'recurring-v3'
    await route.fulfill({ status: 409, json: { error: { code: 'OFFER_REVISION_CONFLICT', message: 'Review the changed offer.' } } })
    return true
  } })
  await page.goto('/setup')
  await page.getByRole('checkbox', { name: /I agree to recurring billing/ }).check()
  await page.getByRole('button', { name: 'Pay and subscribe', exact: true }).click()
  await page.getByRole('button', { name: 'Reload offer and review again' }).click()
  await expect(page.getByRole('button', { name: 'Pay and subscribe', exact: true })).toBeDisabled()
  await page.getByRole('checkbox', { name: /recurring-v3/ }).check()
  await page.getByRole('button', { name: 'Pay and subscribe', exact: true }).click()
  await expect(page).toHaveURL(stripeUrl)
  expect(state.calls.filter(call => call.path === `${billing}/checkout`).map(call => call.body.expectedOfferRevision)).toEqual([3, 4])
})

test('billing return reconciles once, then reads journey without Start or activation writes', async ({ page }) => {
  const state = await setup(page, { handle: async ({ path, reply, state }) => {
    if (path !== `${billing}/refresh`) return false
    state.current.nextAction = 'wait_billing'
    state.current.offer = { state: 'billing_started', checkoutAllowed: false, checkoutMode: 'subscription' }
    state.current.billing = { ...state.current.billing, status: 'checkout_pending', synchronization: 'pending' }
    await reply(state.current.billing)
    return true
  } })
  await page.goto('/billing/return?payment=success')
  await expect(page.getByRole('navigation', { name: 'Setup progress' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Payment confirmed', exact: true })).toHaveCount(0)
  expect(state.calls.filter(call => call.method !== 'GET').map(call => call.path)).toEqual([`${billing}/refresh`])
  const refreshIndex = state.calls.findIndex(call => call.path === `${billing}/refresh`)
  expect(state.calls[refreshIndex + 1].path).toBe('/onboarding/journey')
})

test('flow 4 recovery opens the original verified payment link without new Checkout', async ({ page }) => {
  const state = await setup(page, { handle: async ({ path, reply }) => {
    if (path !== `${billing}/recovery`) return false
    await reply({ state: 'payment_required', nextAction: 'open_payment_page', reason: 'subscription_checkout_required', paymentUrl: stripeUrl })
    return true
  } })
  state.current.nextAction = 'recover_payment'
  state.current.billing.status = 'checkout_pending'
  state.current.offer = { state: 'billing_started', checkoutAllowed: false }
  await page.goto('/setup')
  await page.getByRole('button', { name: 'Resume payment / recover', exact: true }).click()
  await page.getByRole('link', { name: 'Continue secure payment' }).click()
  await expect(page).toHaveURL(stripeUrl)
  expect(state.calls.filter(call => call.method !== 'GET').map(call => call.path)).toEqual([`${billing}/recovery`])
})

test('verified subscription return opens the active workspace without manual activation', async ({ page }) => {
  await page.clock.install()
  const state = await setup(page, { handle: async ({ path, reply, state }) => {
    if (path === `${billing}/refresh`) {
      state.current = { ...state.current, nextAction: 'open_workspace', setup: null, billing: null, offer: null }
      await reply({ flowVersion: 4, status: 'active', billingEligible: true })
      return true
    }
    if (path === billing) {
      await reply({ flowVersion: 4, status: 'active', billingEligible: true })
      return true
    }
    if (path === '/organizations') {
      await reply({ items: [], next: null })
      return true
    }
    return false
  } })
  await page.goto('/billing/return?payment=success')
  await expect(page.getByRole('heading', { name: 'Subscription confirmed', exact: true })).toBeVisible()
  await page.clock.fastForward(2300)
  await expect(page).toHaveURL('/app')
  expect(state.calls.filter(call => call.method !== 'GET').map(call => call.path)).toEqual([`${billing}/refresh`])
})

test('a legacy account keeps its Prepare and Start flow when the offer advertises new admission', async ({ page }) => {
  const state = await setup(page)
  state.current.billing = { ...state.current.billing, flowVersion: 2, status: 'card_ready', startRequired: true }
  state.current.offer.state = 'awaiting_start'
  state.current.offer.checkoutAllowed = false
  state.current.provisioning = null
  state.current.nextAction = 'prepare_workspace'
  await page.goto('/setup')
  await expect(page.getByRole('button', { name: 'Prepare workspace', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pay and subscribe', exact: true })).toHaveCount(0)
  state.current.nextAction = 'review_and_start'
  state.current.provisioning = { status: 'prepared' }
  await page.getByRole('button', { name: 'Check current status', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start subscription', exact: true })).toBeDisabled()
  expect(state.calls.filter(call => call.method !== 'GET')).toEqual([])
})

test('a newer unverified reconciliation overrides an earlier eligible billing read', async ({ page }) => {
  const state = await setup(page, { handle: async ({ path, reply }) => {
    if (path === billing) {
      await reply({ flowVersion: 4, status: 'active', billingEligible: true })
      return true
    }
    if (path === `${billing}/refresh`) {
      await reply({ flowVersion: 4, status: 'past_due', billingEligible: false })
      return true
    }
    if (path === '/organizations') {
      await reply({ items: [], next: null })
      return true
    }
    return false
  } })
  state.current = { ...state.current, nextAction: 'open_workspace', setup: null, billing: null, offer: null }
  await page.goto('/billing/return')
  await expect(page).toHaveURL('/app')
  await expect(page.getByRole('heading', { name: 'Subscription confirmed', exact: true })).toHaveCount(0)
  expect(state.calls.filter(call => call.method !== 'GET').map(call => call.path)).toEqual([`${billing}/refresh`])
})

test('an invalid return status shows a retry and never starts another payment', async ({ page }) => {
  let reads = 0
  const state = await setup(page, { handle: async ({ path, reply }) => {
    if (path !== '/onboarding/journey' || ++reads !== 2) return false
    await reply({})
    return true
  } })
  await page.goto('/billing/return')
  await expect(page.getByRole('alert')).toContainText('unexpected setup status')
  await page.getByRole('button', { name: 'Reload latest data', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Setup progress' })).toBeVisible()
  expect(state.calls.filter(call => call.method !== 'GET').map(call => call.path)).toEqual([`${billing}/refresh`, `${billing}/refresh`])
})
