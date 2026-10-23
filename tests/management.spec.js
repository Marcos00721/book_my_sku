import { expect, test } from '@playwright/test'
import { authUrl, makeSession, mockSignedIn, user } from './helpers/auth'

const orgId = '507f1f77bcf86cd799439011'
const roleId = '507f1f77bcf86cd799439041'
const applicationId = '507f1f77bcf86cd799439031'
const application = {
  id: applicationId,
  status: 'approved',
  revision: 2,
  companyName: 'Acme Promotions',
  firstName: 'Alex',
  lastName: 'Smith',
  email: 'alex@example.com',
  submittedAt: '2026-10-18T00:00:00Z',
}
const catalog = [
  {
    key: 'clients.view',
    label: 'View clients',
    enabled: true,
    scopes: ['all'],
    revision: 0,
  },
  {
    key: 'clients.create',
    label: 'Create clients',
    enabled: true,
    scopes: ['none'],
    revision: 0,
  },
]

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
  await mockSignedIn(page)
})

async function mockManagement(page) {
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname
    const data = path.endsWith('/organizations')
      ? {
          items: [{ id: orgId, name: 'Acme Promotions', status: 'active' }],
          next: null,
        }
      : path.endsWith('/permissions')
        ? {
            owner: true,
            grants: catalog.map((entry) => ({
              key: entry.key,
              scope: entry.scopes[0],
            })),
          }
        : path.endsWith('/access')
          ? { state: 'normal', writesAllowed: true }
          : path.endsWith('/roles/catalog')
            ? { items: catalog }
            : path.endsWith('/roles')
              ? {
                  items: [
                    {
                      id: roleId,
                      name: 'Client manager',
                      archived: false,
                      revision: 3,
                      grants: [],
                    },
                  ],
                  next: null,
                }
              : { items: [], next: null }
    return route.fulfill({ json: { data } })
  })
}

test('team invitations use role IDs and display seat reservation honestly', async ({
  page,
}) => {
  await mockManagement(page)
  let submitted,
    created = false
  await page.route(`**/organizations/${orgId}/invitations*`, (route) => {
    if (route.request().method() === 'POST') {
      submitted = route.request().postDataJSON()
      created = true
      return route.fulfill({
        status: 202,
        json: { data: { id: 'invitation', state: 'reserving' } },
      })
    }
    return route.fulfill({
      json: {
        data: {
          items: created
            ? [
                {
                  id: 'invitation',
                  email: 'teammate@example.com',
                  roleId,
                  role: 'member',
                  state: 'reserving',
                  revision: 0,
                },
              ]
            : [],
          next: null,
        },
      },
    })
  })
  await page.goto('/app/team')
  await page.getByRole('button', { name: 'Invite a teammate' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Email address').fill('teammate@example.com')
  await dialog.getByRole('combobox', { name: 'Role', exact: true }).selectOption(roleId)
  await dialog.getByRole('button', { name: 'Send invitation' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('reserving', { exact: true })).toBeVisible()
  expect(submitted).toEqual({ email: 'teammate@example.com', roleId })
})

test('role creation uses supported catalog scopes and never adds legacy authority', async ({
  page,
}) => {
  await mockManagement(page)
  let submitted
  await page.route(`**/organizations/${orgId}/roles`, (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    submitted = route.request().postDataJSON()
    return route.fulfill({
      status: 201,
      json: { data: { id: roleId, ...submitted, revision: 0 } },
    })
  })
  await page.goto('/app/roles')
  await page.getByRole('button', { name: 'Create role', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Role name').fill('Account team')
  await dialog.getByRole('checkbox', { name: 'View clients' }).check()
  await dialog.getByRole('checkbox', { name: 'Create clients' }).check()
  await dialog.getByRole('button', { name: 'Save role' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(submitted).toEqual({
    name: 'Account team',
    grants: [
      { key: 'clients.view', scope: 'all' },
      { key: 'clients.create', scope: 'none' },
    ],
  })
})

test('platform MFA challenges once and retries authorization with the updated session', async ({
  page,
}) => {
  let verified = false,
    meCalls = 0
  const factorId = '9d01b2c4-d42d-4c0c-ae1e-2aa224bc97e4'
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/admin/me')) {
      meCalls++
      if (!verified)
        return route.fulfill({
          status: 403,
          json: {
            error: {
              code: 'ADMIN_MFA_REQUIRED',
              message: 'A recent authenticator challenge is required.',
            },
          },
        })
      expect(route.request().headers().authorization).toBe(
        'Bearer mfa-verified-access-token',
      )
      return route.fulfill({ json: { data: { role: 'super_admin' } } })
    }
    return route.fulfill({ json: { data: { items: [], nextCursor: null } } })
  })
  await page.route(`${authUrl}/auth/v1/user`, (route) =>
    route.fulfill({
      json: {
        ...user,
        factors: [
          {
            id: factorId,
            factor_type: 'totp',
            status: 'verified',
            friendly_name: 'My authenticator',
          },
        ],
      },
    }),
  )
  await page.route(
    `${authUrl}/auth/v1/factors/${factorId}/challenge`,
    (route) =>
      route.fulfill({
        json: {
          id: 'challenge-id',
          expires_at: Math.floor(Date.now() / 1000) + 300,
        },
      }),
  )
  await page.route(`${authUrl}/auth/v1/factors/${factorId}/verify`, (route) => {
    expect(route.request().postDataJSON().code).toBe('123456')
    verified = true
    return route.fulfill({ json: makeSession('mfa-verified-access-token') })
  })
  await page.goto('/admin')
  await page.getByLabel('Authenticator code').fill('123456')
  await page.getByRole('button', { name: 'Verify and continue' }).click()
  await expect(
    page.getByRole('tab', { name: 'Applications', exact: true }),
  ).toBeVisible()
  expect(meCalls).toBeLessThan(5)
})

test('billing extensions render the exact server preview before applying its ID', async ({
  page,
}) => {
  let submitted
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname
    const data = path.endsWith('/admin/me')
      ? { role: 'super_admin' }
      : path.endsWith('/admin/applications')
        ? { items: [application], nextCursor: null }
        : path.endsWith(`/applications/${applicationId}`)
          ? { application, offer: null, organization: { status: 'active' } }
          : path.endsWith('/billing')
            ? {
                status: 'trialing',
                revision: 5,
                quantity: 2,
                activationEligible: true,
              }
            : { items: [], nextCursor: null }
    return route.fulfill({ json: { data } })
  })
  await page.route('**/billing/extensions/preview', (route) =>
    route.fulfill({
      json: {
        data: {
          previewId: 'd9b2d90e-6ee7-4db8-b52e-1258d2f22e80',
          expiresAt: '2026-10-20T12:00:00Z',
          preview: {
            before: { trialEnd: 1792454400 },
            after: { trialEnd: 1795132800 },
            immediateChargeMinor: 0,
            quantity: 2,
          },
        },
      },
    }),
  )
  await page.route('**/billing/extensions', (route) => {
    submitted = route.request().postDataJSON()
    return route.fulfill({ json: { data: { status: 'pending' } } })
  })
  await page.goto('/admin')
  await page.getByRole('button', { name: 'Open application' }).click()
  await page
    .getByRole('button', { name: 'Preview trial / discount extension' })
    .click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: 'Reason', exact: true }).fill('Approved extension')
  await dialog
    .getByRole('button', { name: 'Preview extension', exact: true })
    .click()
  await expect(dialog.getByText(/trialEnd:/)).toBeVisible()
  await expect(
    dialog.getByText('Immediate charge: $0.00. No proration or refund.'),
  ).toBeVisible()
  expect(submitted).toBeUndefined()
  await dialog.getByRole('button', { name: 'Apply reviewed extension' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(submitted).toEqual({
    previewId: 'd9b2d90e-6ee7-4db8-b52e-1258d2f22e80',
  })
})
