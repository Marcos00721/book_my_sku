# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: snackbar.spec.js >> list failure appears in a snackbar and retry clears it
- Location: tests\snackbar.spec.js:34:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.app-snackbar')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('.app-snackbar') with timeout 5000ms
  - waiting for locator('.app-snackbar')

```

```yaml
- link "Skip to content":
  - /url: "#workspace-main"
- complementary "Workspace sidebar":
  - link "BookMySku home":
    - /url: /app
  - button "Collapse sidebar" [expanded]
  - searchbox "Find a page"
  - navigation "Workspace navigation":
    - paragraph: Overview
    - link "Overview":
      - /url: /app
    - paragraph: Relationships
    - link "Leads":
      - /url: /app/leads
  - strong: Team member
  - text: alex@example.com
  - button "Sign out"
- banner:
  - text: Acme workspace
  - list "Breadcrumb":
    - listitem:
      - link "Workspace":
        - /url: /app
    - listitem: Leads
  - button "Quick create"
  - button "Switch to light mode"
- main:
  - status: Loading list…
- contentinfo: BookMySku
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test'
  2  | import { mockSignedIn } from './helpers/auth'
  3  | 
  4  | const organizationId = '507f1f77bcf86cd799439011'
  5  | const base = `/api/v1/organizations/${organizationId}`
  6  | 
  7  | async function mockWorkspace(page, { failList = false } = {}) {
  8  |   await mockSignedIn(page)
  9  |   let listRequests = 0
  10 |   let submissions = 0
  11 |   await page.route('**/api/v1/**', async (route) => {
  12 |     const request = route.request()
  13 |     const path = new URL(request.url()).pathname
  14 |     const reply = (data) => route.fulfill({ json: { data } })
  15 |     if (path === '/api/v1/organizations') return reply({ items: [{ id: organizationId, name: 'Acme workspace', status: 'active' }], next: null })
  16 |     if (path.endsWith('/permissions')) return reply({ owner: false, grants: ['inquiries.view', 'inquiries.create'].map((key) => ({ key, scope: 'all' })) })
  17 |     if (path.endsWith('/access')) return reply({ writesAllowed: true, state: 'normal' })
  18 |     if (path === `${base}/inquiries`) {
  19 |       if (request.method() === 'POST') {
  20 |         submissions += 1
  21 |         return route.fulfill({ status: 422, json: { error: { message: 'This company already has a lead.', code: 'VALIDATION_FAILED', requestId: 'lead-support-ref', fields: [{ field: 'companyName', message: 'Use a different company name.' }] } } })
  22 |       }
  23 |       listRequests += 1
  24 |       if (failList && listRequests === 1) {
  25 |         return route.fulfill({ status: 503, json: { error: { message: 'Could not load leads. Please try again.', code: 'TEMPORARY_ERROR' } } })
  26 |       }
  27 |       return reply({ items: [], next: null })
  28 |     }
  29 |     return reply({ items: [], next: null })
  30 |   })
  31 |   return { submissions: () => submissions }
  32 | }
  33 | 
  34 | test('list failure appears in a snackbar and retry clears it', async ({ page }) => {
  35 |   await mockWorkspace(page, { failList: true })
  36 |   await page.goto('/app/leads')
  37 |   const snackbar = page.locator('.app-snackbar')
> 38 |   await expect(snackbar).toBeVisible()
     |                          ^ Error: expect(locator).toBeVisible() failed
  39 |   await expect(snackbar).toContainText('Could not load leads. Please try again.')
  40 |   await snackbar.getByRole('button', { name: 'Reload latest data' }).click()
  41 |   await expect(snackbar).toHaveCount(0)
  42 |   await expect(page.getByText('No leads yet', { exact: true })).toBeVisible()
  43 | })
  44 | 
  45 | for (const theme of ['light', 'dark']) {
  46 |   test(`modal errors remain interactive and fit on mobile in ${theme} mode`, async ({ page }, testInfo) => {
  47 |     const state = await mockWorkspace(page, { failList: true })
  48 |     await page.addInitScript((value) => localStorage.setItem('theme', value), theme)
  49 |     await page.setViewportSize({ width: 375, height: 812 })
  50 |     await page.goto('/app/leads')
  51 |     await expect(page.locator('.app-snackbar')).toBeVisible()
  52 |     await page.getByRole('button', { name: 'Quick create', exact: true }).click()
  53 |     await page.getByRole('menuitem', { name: 'Add lead', exact: true }).click()
  54 |     const dialog = page.getByRole('dialog', { name: 'Add lead', exact: true })
  55 |     await dialog.getByLabel('Company name').fill('Acme Studio')
  56 |     await dialog.getByLabel('Contact name').fill('Alex Smith')
  57 |     await dialog.getByLabel('Email address').fill('alex@example.com')
  58 |     await dialog.getByLabel('Requirement', { exact: true }).fill('100 branded shirts')
  59 |     await dialog.getByRole('button', { name: 'Add lead', exact: true }).click()
  60 |     const snackbar = dialog.locator('.app-snackbar')
  61 |     await expect(snackbar).toBeVisible()
  62 |     await expect(snackbar).toContainText('This company already has a lead.')
  63 |     await expect(snackbar).toContainText('Support reference: lead-support-ref')
  64 |     await expect(dialog.getByLabel('Company name')).toHaveAttribute('aria-invalid', 'true')
  65 |     await expect(dialog.getByLabel('Company name')).toHaveValue('Acme Studio')
  66 |     const bounds = await snackbar.boundingBox()
  67 |     expect(bounds.x).toBeGreaterThanOrEqual(0)
  68 |     expect(bounds.x + bounds.width).toBeLessThanOrEqual(375)
  69 |     expect(bounds.y + bounds.height).toBeLessThanOrEqual(812)
  70 |     const positions = await page.locator('.app-snackbar').evaluateAll((nodes) => nodes.map((node) => {
  71 |       const rect = node.getBoundingClientRect()
  72 |       return { top: rect.top, bottom: rect.bottom }
  73 |     }))
  74 |     expect(positions[0].bottom).toBeLessThanOrEqual(positions[1].top)
  75 |     await page.screenshot({ path: testInfo.outputPath(`snackbar-${theme}.png`) })
  76 |     await snackbar.getByRole('button', { name: 'Dismiss error' }).click()
  77 |     await expect(snackbar).toHaveCount(0)
  78 |     expect(state.submissions()).toBe(1)
  79 |     await expect(dialog.getByRole('button', { name: 'Add lead', exact: true })).toBeFocused()
  80 |     await dialog.getByLabel('Company name').fill('Another company')
  81 |     await dialog.getByRole('button', { name: 'Add lead', exact: true }).click()
  82 |     await expect(snackbar).toBeVisible()
  83 |     expect(state.submissions()).toBe(2)
  84 |   })
  85 | }
  86 | 
```