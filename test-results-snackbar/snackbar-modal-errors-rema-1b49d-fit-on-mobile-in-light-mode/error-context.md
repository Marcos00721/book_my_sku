# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: snackbar.spec.js >> modal errors remain interactive and fit on mobile in light mode
- Location: tests\snackbar.spec.js:46:3

# Error details

```
Error: expect(received).toBeLessThanOrEqual(expected)

Expected: <= 536.828125
Received:    796
```

# Page snapshot

```yaml
- generic [ref=e4]:
  - link "Skip to content" [ref=e5] [cursor=pointer]:
    - /url: "#workspace-main"
  - generic [ref=e6]:
    - banner [ref=e8]:
      - generic [ref=e9]:
        - button "Open navigation" [ref=e10] [cursor=pointer]
        - generic [ref=e12]:
          - generic [ref=e13]: Acme workspace
          - list "Breadcrumb" [ref=e14]:
            - listitem [ref=e15]:
              - link "Workspace" [ref=e16] [cursor=pointer]:
                - /url: /app
            - listitem [aria-hidden] [ref=e17]
            - listitem [ref=e20]: Leads
      - generic [ref=e21]:
        - button "Quick create" [ref=e23] [cursor=pointer]
        - dialog [ref=e25]:
          - banner [ref=e26]:
            - generic [ref=e27]:
              - heading "Add lead" [level=2] [ref=e28]
              - paragraph [ref=e29]: Capture the company, contact, and what they need.
            - button "Close dialog" [ref=e31] [cursor=pointer]
          - generic [ref=e36]:
            - group [ref=e37]:
              - generic [ref=e38]:
                - generic [ref=e39]:
                  - text: Company name
                  - generic [aria-hidden] [ref=e40]: "*"
                - textbox "Company name" [invalid] [ref=e42]: Acme Studio
                - alert [ref=e43]: Use a different company name.
              - generic [ref=e44]:
                - generic [ref=e45]:
                  - text: Contact name
                  - generic [aria-hidden] [ref=e46]: "*"
                - textbox "Contact name" [ref=e48]: Alex Smith
              - generic [ref=e49]:
                - generic [ref=e50]:
                  - text: Email address
                  - generic [aria-hidden] [ref=e51]: "*"
                - textbox "Email address" [ref=e53]: alex@example.com
              - generic [ref=e54]:
                - generic [ref=e55]: Phone
                - textbox "Phone" [ref=e57]
              - generic [ref=e58]:
                - generic [ref=e59]: Requested in-hands date
                - textbox "Requested in-hands date" [ref=e61]
              - generic [ref=e62]:
                - generic [ref=e63]:
                  - text: Requirement
                  - generic [aria-hidden] [ref=e64]: "*"
                - textbox "Requirement" [ref=e65]: 100 branded shirts
            - alert [ref=e66]:
              - generic [ref=e70]:
                - paragraph [ref=e71]: This company already has a lead.
                - generic [ref=e72]: VALIDATION_FAILED
                - paragraph [ref=e73]: "companyName: Use a different company name."
                - generic [ref=e74]: "Support reference: lead-support-ref"
              - button "Dismiss error" [ref=e75] [cursor=pointer]
            - generic [ref=e79]:
              - button "Clear" [ref=e80] [cursor=pointer]
              - button "Cancel" [ref=e81] [cursor=pointer]
              - button "Add lead" [ref=e82] [cursor=pointer]
        - button "Switch to dark mode" [ref=e85]
    - main [ref=e88]:
      - generic [ref=e90]:
        - heading "Leads" [level=1] [ref=e91]
        - paragraph [ref=e92]: Keep track of incoming interest, from first inquiry to a qualified opportunity.
      - region "Lead list" [ref=e93]:
        - generic [ref=e94]:
          - generic [ref=e95]:
            - generic [ref=e96]: Search leads
            - searchbox "Search leads" [ref=e98]
          - generic [ref=e99]:
            - generic [ref=e100]:
              - generic [ref=e101]: Lead stage
              - button "Lead stage" [ref=e103] [cursor=pointer]:
                - generic [ref=e104]: All stages
            - button "Refresh leads" [ref=e107] [cursor=pointer]: Refresh
        - paragraph [ref=e113]: Search matches the start of the company name. Newest leads appear first.
        - alert [ref=e114]:
          - generic [ref=e118]:
            - paragraph [ref=e119]: Could not load leads. Please try again.
            - generic [ref=e120]: TEMPORARY_ERROR
            - button "Reload latest data" [ref=e121] [cursor=pointer]
          - button "Dismiss error" [ref=e122] [cursor=pointer]
    - contentinfo [ref=e126]:
      - generic [ref=e127]: BookMySku
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
  38 |   await expect(snackbar).toBeVisible()
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
> 74 |     expect(positions[0].bottom).toBeLessThanOrEqual(positions[1].top)
     |                                 ^ Error: expect(received).toBeLessThanOrEqual(expected)
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