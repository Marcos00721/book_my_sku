import { expect, test } from '@playwright/test'
import { mockSignedIn } from './helpers/auth'
import { mockGeography } from './helpers/geography'

test('company PATCH uses the revision from setup GET, bearer JSON and no cookie credentials', async ({
  page,
}) => {
  await mockSignedIn(page)
  await mockGeography(page)
  await page.addInitScript(() => {
    window.setupTransports = []
    const open = XMLHttpRequest.prototype.open
    const send = XMLHttpRequest.prototype.send
    XMLHttpRequest.prototype.open = function (method, url, ...args) {
      this.isSetupRequest = String(url).endsWith('/onboarding/setup')
      this.setupMethod = method
      return open.call(this, method, url, ...args)
    }
    XMLHttpRequest.prototype.send = function (...args) {
      if (this.isSetupRequest)
        window.setupTransports.push({
          method: this.setupMethod,
          withCredentials: this.withCredentials,
        })
      return send.apply(this, args)
    }
  })
  const calls = []
  let current = {
    revision: 8,
    industry: 'Current server classification',
    asiNumber: '',
    address: {},
    complete: false,
    locked: false,
  }
  const actorId = '507f1f77bcf86cd799439099'
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace('/api/v1', '')
    if (path.startsWith('/reference/')) return route.fallback()
    calls.push({ method: request.method(), path })
    expect(request.headers().authorization).toBe(
      'Bearer registration-access-token',
    )
    if (path === '/onboarding/journey')
      return route.fulfill({
        json: {
          data: {
            actorId,
            nextAction: 'complete_company',
            application: {
              id: '507f1f77bcf86cd799439031',
              status: 'approved',
              mode: 'shared',
            },
            setup: {
              ...current,
              revision: 4,
              industry: 'Older journey classification',
            },
            billing: null,
            offer: null,
            provisioning: null,
          },
        },
      })
    if (path === '/onboarding/setup') {
      if (request.method() === 'GET')
        return route.fulfill({ json: { data: current } })
      expect(request.method()).toBe('PATCH')
      expect(request.headers()['content-type']).toBe('application/json')
      const { expectedRevision, ...fields } = request.postDataJSON()
      expect(expectedRevision).toBe(8)
      current = { ...current, ...fields, revision: 9 }
      return route.fulfill({ json: { data: current } })
    }
    return route.fulfill({
      status: 500,
      json: { error: { code: 'UNEXPECTED_REQUEST' } },
    })
  })
  await page.goto('/setup')
  const industry = page.getByLabel('Industry', { exact: true })
  await expect(industry).toBeEnabled()
  await expect(industry).toHaveValue('Current server classification')
  await industry.fill('Education')
  await page
    .getByRole('button', { name: 'Save company details', exact: true })
    .click()
  await expect(
    page.getByText('Saved revision 9', { exact: true }),
  ).toBeVisible()
  expect(calls).toEqual([
    { method: 'GET', path: '/onboarding/journey' },
    { method: 'GET', path: '/onboarding/setup' },
    { method: 'PATCH', path: '/onboarding/setup' },
  ])
  const transports = await page.evaluate(() => window.setupTransports)
  expect(transports).toEqual([
    { method: 'GET', withCredentials: false },
    { method: 'PATCH', withCredentials: false },
  ])
})
