import { expect, test } from '@playwright/test'
import { mockSignedIn } from './helpers/auth'
import { mockGeography } from './helpers/geography'

test('an uncertain company completion remains retryable after an offer change without carrying old payment consent', async ({
  page,
}) => {
  await mockSignedIn(page)
  await mockGeography(page)
  const applicationId = '507f1f77bcf86cd799439031'
  let company = {
    revision: 8,
    complete: false,
    locked: false,
    industry: 'Distributor',
    asiNumber: '',
    address: {
      line1: '1 Main Street',
      line2: '',
      city: 'Jaipur',
      postalCode: '302001',
      country: 'IN',
      stateCode: 'IN-RJ',
    },
  }
  let offerRevision = 3,
    completions = 0,
    prepared = false
  const billingWrites = []
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace('/api/v1', '')
    if (path.startsWith('/reference/')) return route.fallback()
    const reply = (data) => route.fulfill({ json: { data } })
    if (path === '/onboarding/journey')
      return reply({
        actorId: '507f1f77bcf86cd799439099',
        application: { id: applicationId, status: 'approved', mode: 'shared' },
        setup: company,
        nextAction: !company.complete
          ? 'complete_company'
          : prepared
            ? 'review_offer'
            : 'prepare_workspace',
        platform: { ready: true },
        provisioning: prepared ? { status: 'prepared' } : null,
        billing: { flowVersion: 2, status: 'not_started', quantity: 1 },
        offer: {
          state: 'available',
          checkoutAllowed: true,
          initialQuantity: 1,
          offer: {
            revision: offerRevision,
            currency: 'usd',
            interval: 'month',
            phases: [{ kind: 'standard', months: null, unitAmountMinor: 4900 }],
          },
          consent: {
            termsVersion: 'recurring-v2',
            termsUrl: 'https://example.com/terms',
          },
        },
      })
    if (path === '/onboarding/setup') return reply(company)
    if (path === '/onboarding/setup/complete') {
      if (++completions === 1)
        return route.fulfill({
          status: 503,
          json: {
            error: {
              code: 'SETUP_RETRY_REQUIRED',
              message: 'Completion could not be confirmed.',
            },
          },
        })
      company = { ...company, revision: 9, complete: true }
      return reply(company)
    }
    if (path === '/onboarding/setup/prepare') {
      prepared = true
      company.locked = true
      return reply({ status: 'prepared' })
    }
    billingWrites.push(path)
    return route.fulfill({
      status: 500,
      json: { error: { code: 'UNEXPECTED_REQUEST' } },
    })
  })
  await page.goto('/setup')
  await page
    .getByRole('checkbox', { name: /I agree to recurring billing/ })
    .check()
  await page
    .getByRole('button', {
      name: 'Finish setup and continue to payment',
      exact: true,
    })
    .click()
  await expect(page.getByRole('alert').first()).toContainText(
    'SETUP_CHANGED',
  )
  offerRevision = 4
  await page
    .getByRole('button', { name: 'Check current status', exact: true })
    .click()
  await expect(
    page.getByRole('checkbox', { name: /I agree to recurring billing/ }),
  ).not.toBeChecked()
  const retry = page.getByRole('button', {
    name: 'Retry completion',
    exact: true,
  })
  await expect(retry).toBeEnabled()
  await retry.click()
  await expect(
    page.getByRole('button', {
      name: 'Continue to secure Checkout',
      exact: true,
    }),
  ).toBeDisabled()
  expect(completions).toBe(2)
  expect(billingWrites).toEqual([])
})
