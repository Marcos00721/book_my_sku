import { expect, test } from '@playwright/test'
import { mockSignedIn } from './helpers/auth'

const orgId = '507f1f77bcf86cd799439011'
const roleId = '507f1f77bcf86cd799439041'
const invitation = {
  id: '507f1f77bcf86cd799439071',
  email: 'jordan@example.com',
  roleId,
  state: 'ready',
  revision: 3,
  expiresAt: '2026-12-01T12:00:00Z',
}
const member = {
  id: '507f1f77bcf86cd799439072',
  email: 'sam@example.com',
  roleId,
  permissionRevision: 7,
  invitationId: invitation.id,
  revision: 4,
}

async function mockTeam(page, { owner = true, writesAllowed = true } = {}) {
  await mockSignedIn(page)
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname
    const data = path.endsWith('/organizations')
      ? { items: [{ id: orgId, name: 'Acme Promotions', status: 'active', owner }], next: null }
      : path.endsWith('/permissions')
        ? { owner, organizationId: orgId, grants: [] }
        : path.endsWith('/access')
          ? { state: writesAllowed ? 'normal' : 'restricted', writesAllowed, nextAction: 'none' }
          : path.endsWith('/members')
            ? { items: [{ id: 'owner', email: 'alex@example.com', role: 'owner' }, member], next: null }
            : path.endsWith('/invitations')
              ? { items: [invitation], next: null }
              : path.endsWith('/roles')
                ? { items: [{ id: roleId, name: 'Client manager', archived: false }], next: null }
                : { items: [], next: null }
    return route.fulfill({ json: { data } })
  })
}

test('team tabs show one table and preserve search and opaque pagination when switching', async ({ page }) => {
  await mockTeam(page)
  const queries = []
  await page.route('**/members?*', (route) => {
    const params = new URL(route.request().url()).searchParams
    queries.push(params.get('after'))
    return route.fulfill({ json: { data: params.has('after')
      ? { items: [{ ...member, email: 'second@example.com' }], next: null }
      : { items: [member], next: 'opaque-cursor+/=' } } })
  })
  await page.goto('/app/team')
  await expect(page.getByRole('table')).toHaveCount(1)
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('second@example.com', { exact: true })).toBeVisible()
  const search = page.getByRole('searchbox', { name: 'Search members on this page' })
  await search.fill('second')
  await page.getByRole('tab', { name: 'Workspace members' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Invitations' })).toBeFocused()
  await expect(page.getByRole('table', { name: 'Invitations' })).toBeVisible()
  await page.keyboard.press('Home')
  await expect(search).toHaveValue('second')
  expect(queries.at(-1)).toBe('opaque-cursor+/=')
  await search.fill('missing')
  await expect(page.getByText('No matches on this page')).toBeVisible()
  await page.getByRole('button', { name: 'Clear search' }).click()
  await expect(page.getByText('second@example.com', { exact: true })).toBeVisible()
})

test('invite focuses email, requires an explicit role, and opens invitations after saving', async ({ page }) => {
  await mockTeam(page)
  let submitted
  await page.route('**/invitations', (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    submitted = route.request().postDataJSON()
    return route.fulfill({ json: { data: invitation } })
  })
  await page.goto('/app/team')
  await page.getByRole('button', { name: 'Invite a teammate' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Email address')).toBeFocused()
  await expect(dialog.getByRole('button', { name: 'Send invitation' })).toBeDisabled()
  await dialog.getByLabel('Email address').fill('jordan@example.com')
  await dialog.getByLabel('Role', { exact: true }).click()
  await page.getByRole('option', { name: 'Client manager' }).click()
  await dialog.getByRole('button', { name: 'Send invitation' }).click()
  await expect(dialog).toHaveCount(0)
  expect(submitted).toEqual({ email: invitation.email, roleId })
  await expect(page.getByRole('tab', { name: 'Invitations' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('Invitation sent. Track its status in Invitations.')).toBeVisible()
})

test('one-click resend recovers an uncertain result with the same revision and idempotency key', async ({ page }) => {
  await mockTeam(page)
  const attempts = []
  await page.route(`**/invitations/${invitation.id}/resend`, (route) => {
    attempts.push({ body: route.request().postDataJSON(), key: route.request().headers()['idempotency-key'] })
    return attempts.length === 1
      ? route.fulfill({ status: 503, json: { error: { code: 'TEMPORARY', message: 'Try again.' } } })
      : route.fulfill({ json: { data: { ...invitation, revision: 4 } } })
  })
  await page.goto('/app/team')
  await page.getByRole('tab', { name: 'Invitations' }).click()
  await page.getByRole('button', { name: 'Resend', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Change role' })).toBeDisabled()
  await page.getByRole('button', { name: 'Retry resend' }).click()
  await expect(page.getByText(`Invitation resent to ${invitation.email}.`)).toBeVisible()
  expect(attempts).toHaveLength(2)
  expect(attempts[0].body).toEqual({ expectedRevision: 3 })
  expect(attempts[0].key).toBeTruthy()
  expect(attempts[1]).toEqual(attempts[0])
})

test('role edits and member removal retain the exact revision and destructive confirmation', async ({ page }) => {
  await mockTeam(page)
  let assignment, removed
  await page.route(`**/roles/assignments/${member.id}`, (route) => {
    assignment = route.request().postDataJSON()
    return route.fulfill({ json: { data: member } })
  })
  await page.route(`**/members/${member.id}`, (route) => {
    removed = route.request().postDataJSON()
    return route.fulfill({ json: { data: { removed: true } } })
  })
  await page.goto('/app/team')
  await page.getByRole('button', { name: 'Change role' }).click()
  await expect(page.getByRole('dialog')).toContainText(member.email)
  await page.getByRole('button', { name: 'Save role' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(assignment).toEqual({ expectedRevision: 7, roleId })
  await page.getByRole('button', { name: 'Remove', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Remove team member' })).toBeVisible()
  expect(removed).toBeUndefined()
  await page.getByRole('button', { name: 'Remove member', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(removed).toEqual({ expectedRevision: 4 })
})

for (const width of [375, 1440]) {
  test(`team and invite modal fit ${width}px in light and dark mode`, async ({ page }, testInfo) => {
    await mockTeam(page)
    await page.setViewportSize({ width, height: 850 })
    await page.addInitScript(() => localStorage.setItem('theme', 'light'))
    await page.goto('/app/team')
    await expect(page.getByText(member.email, { exact: true })).toBeVisible()
    for (const mode of ['light', 'dark']) {
      if (mode === 'dark') await page.getByRole('button', { name: 'Switch to dark mode' }).click()
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      const table = page.locator('.table-scroll').first()
      expect(await table.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath(`team-${mode}.png`), fullPage: true })
      await page.getByRole('button', { name: 'Invite a teammate' }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
      const box = await dialog.boundingBox()
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(width)
      expect(box.y + box.height).toBeLessThanOrEqual(850)
      await page.screenshot({ path: testInfo.outputPath(`team-invite-${mode}.png`), fullPage: true })
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    }
  })
}

test('team ownership and invitation write restrictions remain enforced', async ({ page }) => {
  await mockTeam(page, { writesAllowed: false })
  await page.goto('/app/team')
  await expect(page.getByRole('button', { name: 'Invite a teammate' })).toHaveCount(0)
  await page.getByRole('tab', { name: 'Invitations' }).click()
  await expect(page.getByRole('button', { name: 'Resend', exact: true })).toHaveCount(0)
  await mockTeam(page, { owner: false })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Access is limited' })).toBeVisible()
  await expect(page.getByRole('tablist', { name: 'Team views' })).toHaveCount(0)
})
