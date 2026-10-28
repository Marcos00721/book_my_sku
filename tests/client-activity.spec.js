import { expect, test } from '@playwright/test'
import { mockSignedIn } from './helpers/auth'

const org = '507f1f77bcf86cd799439011'
const clientId = '507f1f77bcf86cd799439021'
const root = `/organizations/${org}/clients/${clientId}`

async function workspace(page, history = true) {
  await mockSignedIn(page)
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '')
    const data =
      path === '/organizations'
        ? {
            items: [
              { id: org, name: 'QA Workspace', status: 'active', owner: false },
            ],
            next: null,
          }
        : path.endsWith('/permissions')
          ? {
              owner: false,
              organizationId: org,
              grants: [
                { key: 'clients.view', scope: 'all' },
                ...(history
                  ? [{ key: 'clients.history.view', scope: 'all' }]
                  : []),
              ],
            }
          : path.endsWith('/access')
            ? { state: 'normal', writesAllowed: true }
            : path === root
              ? { _id: clientId, name: 'BookMySKU QA Client', __v: 0 }
              : { items: [], next: null }
    await route.fulfill({ json: { data } })
  })
}

const event = {
  id: '507f1f77bcf86cd799439051',
  action: 'client.renamed',
  origin: 'api',
  actor: {
    id: '507f1f77bcf86cd799439061',
    label: 'QA Tester · actor-id',
    membershipStatus: 'current',
  },
  entity: { type: 'client', id: clientId },
  occurredAt: '2026-10-28T10:00:00Z',
  beforeRevision: 0,
  afterRevision: 1,
  changes: [
    {
      field: 'name',
      before: 'Old client',
      after: '<img src=x onerror=alert(1)>',
    },
  ],
}

test('activity renders protected actor and changes as text, follows opaque cursors and clears on denial', async ({
  page,
}) => {
  await workspace(page)
  const seen = []
  let denied = false
  await page.route(`**${root}/activity?**`, async (route) => {
    const url = new URL(route.request().url())
    seen.push(Object.fromEntries(url.searchParams))
    expect(route.request().headers().authorization).toBe(
      'Bearer registration-access-token',
    )
    if (denied)
      return route.fulfill({
        status: 403,
        json: {
          error: {
            code: 'PERMISSION_DENIED',
            message: 'Permission is unavailable',
          },
        },
      })
    const second = url.searchParams.has('after')
    await route.fulfill({
      json: {
        data: {
          coverageStartedAt: '2026-10-24T00:00:00Z',
          items: [
            second
              ? {
                  ...event,
                  id: 'second-event',
                  actor: {
                    ...event.actor,
                    label: 'Former member · actor-id',
                    membershipStatus: 'former',
                  },
                  changes: [],
                }
              : event,
          ],
          next: second ? null : 'opaque_cursor_123',
        },
      },
    })
  })
  await page.goto(`/app/clients/${clientId}`)
  await page.getByRole('tab', { name: 'Activity', exact: true }).click()
  await expect(
    page.getByText('Detailed history unavailable before', { exact: false }),
  ).toBeVisible()
  await expect(
    page.getByText('QA Tester · actor-id', { exact: false }),
  ).toBeVisible()
  await expect(
    page.getByRole('cell', {
      name: '<img src=x onerror=alert(1)>',
      exact: true,
    }),
  ).toBeVisible()
  await expect(page.locator('article img')).toHaveCount(0)
  await page.getByRole('button', { name: 'Next activity' }).click()
  await expect(
    page.getByText('Former member · actor-id', { exact: false }),
  ).toBeVisible()
  expect(seen.at(-1)).toEqual({ limit: '25', after: 'opaque_cursor_123' })
  await page.getByRole('button', { name: 'Previous activity' }).click()
  await expect(
    page.getByText('QA Tester · actor-id', { exact: false }),
  ).toBeVisible()
  denied = true
  await page.getByRole('button', { name: 'Refresh history' }).click()
  await expect(page.getByRole('alert')).toContainText('PERMISSION_DENIED')
  await expect(
    page.getByText('QA Tester · actor-id', { exact: false }),
  ).toHaveCount(0)
})

test('client viewers without history permission do not request or see the activity tab', async ({
  page,
}) => {
  await workspace(page, false)
  let requests = 0
  await page.route(`**${root}/activity**`, (route) => {
    requests++
    return route.abort()
  })
  await page.goto(`/app/clients/${clientId}`)
  await expect(
    page.getByRole('heading', { name: 'BookMySKU QA Client', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('tab', { name: 'Activity', exact: true }),
  ).toHaveCount(0)
  expect(requests).toBe(0)
})
