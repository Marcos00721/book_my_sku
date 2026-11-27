import { expect, test } from '@playwright/test'
import { mockSignedIn } from './helpers/auth'
import { contrastRatio } from './helpers/contrast'

const pendingId = '507f1f77bcf86cd799439031'
const approvedId = '507f1f77bcf86cd799439032'
const pending = {
  id: pendingId, companyName: 'Northstar Merch Co.', firstName: 'Emma', lastName: 'Wilson',
  email: 'emma@northstarmerch.com', contactNumber: '+14155550123', companyWebsite: 'https://northstarmerch.com',
  status: 'pending', revision: 3, submittedAt: '2026-11-20T09:30:00Z',
}
const approved = { ...pending, id: approvedId, companyName: 'Studio Forma', firstName: 'James', lastName: 'Chen', email: 'james@studioforma.co', status: 'approved' }

async function setup(page, mode = 'light', draftOffer = null) {
  await mockSignedIn(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(theme => localStorage.setItem('theme', theme), mode)
  await page.route('https://fonts.googleapis.com/**', route => route.abort())
  await page.route('https://fonts.gstatic.com/**', route => route.abort())
  const current = { ...pending }
  const writes = []
  const queries = []
  const companies = [current, ...['Oak & Thread', 'Made Collective', 'Atlas Brand Supply', 'The Good Company', 'Fieldwork Promotional Products International'].map((companyName, index) => ({
    ...pending, id: `pending-${index}`, companyName, firstName: ['Olivia', 'Noah', 'Sophia', 'Liam', 'Mia'][index], lastName: ['Taylor', 'Patel', 'Martin', 'Anderson', 'Garcia'][index],
    email: index === 4 ? 'purchasing.and.brand.partnerships@fieldwork-promotional.com' : `hello@company${index}.com`,
  })), approved, { ...pending, id: 'rejected', companyName: 'Brightside Goods', status: 'rejected', reason: 'Please provide your company website and a working contact number.' }]
  await page.route('**/api/v1/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace('/api/v1', '')
    let data = { items: [], nextCursor: null }
    if (path === '/admin/me') data = { role: 'super_admin' }
    else if (path === '/admin/plan') data = { plan: { version: 3, unitAmountMinor: 2900 } }
    else if (path.endsWith('/offer') && request.method() === 'PUT') {
      writes.push(request.postDataJSON())
      data = { offer: draftOffer }
    }
    else if (path === '/admin/applications') {
      queries.push(Object.fromEntries(url.searchParams))
      const status = url.searchParams.get('status')
      const email = url.searchParams.get('email')
      const after = url.searchParams.get('after')
      const items = companies.filter(item => (!status || item.status === status) && (!email || item.email === email))
      data = { items: after ? [{ ...pending, id: 'page-two', companyName: 'Next page company' }] : items, nextCursor: !after && !email && status === 'pending' ? 'next-page' : null }
    } else if (/\/admin\/applications\/[^/]+\/review$/.test(path)) {
      const body = request.postDataJSON()
      writes.push(body)
      Object.assign(current, { status: body.decision === 'approve' ? 'approved' : 'rejected', reason: body.reason, revision: current.revision + 1 })
      data = { application: current }
    } else if (path.endsWith('/billing')) data = { status: 'trialing', revision: 5, quantity: 12, activationEligible: true }
    else if (/\/admin\/applications\/[^/]+$/.test(path)) {
      const id = path.split('/').at(-1)
      const application = companies.find(item => item.id === id) || current
      data = {
        application,
        offer: draftOffer || (application.status === 'approved' ? { revision: 2, status: 'accepted', terms: { unitAmountMinor: 2900, currency: 'USD', discount: { type: 'none' } } } : null),
        organization: !draftOffer && application.status === 'approved' ? { status: 'active' } : null,
      }
    }
    await route.fulfill({ json: { data } })
  })
  return { queries, writes }
}

for (const mode of ['light', 'dark']) {
  for (const width of [390, 1440]) {
    test(`application queue and review use available space in ${mode} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 })
      await setup(page, mode)
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto('/admin?section=applications')
      const queue = page.getByRole('region', { name: 'Company applications' })
      await expect(queue.getByRole('button', { name: 'Open application' })).toHaveCount(6)
      await expect(queue).toContainText('emma@northstarmerch.com')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      expect(await contrastRatio(queue.locator('.admin-application-status').first())).toBeGreaterThanOrEqual(4.5)
      const firstCompany = await queue.locator('.admin-application-company').first().boundingBox()
      expect(firstCompany.y).toBeLessThan(width < 680 ? 480 : 420)
      for (const button of await queue.getByRole('button', { name: 'Open application' }).all()) {
        const rect = await button.boundingBox()
        expect(rect.x + rect.width).toBeLessThanOrEqual(width)
      }
      await page.screenshot({ path: testInfo.outputPath(`queue-${mode}-${width}.png`), fullPage: true })
      await queue.getByRole('button', { name: 'Open application' }).first().click()
      await expect(page.getByRole('heading', { name: 'Northstar Merch Co.', exact: true })).toBeVisible()
      const approve = page.getByRole('button', { name: 'Approve application', exact: true })
      await expect(approve).toBeVisible()
      await expect(page.locator('.admin-application-contact')).toContainText('Emma Wilson')
      await expect(page.getByRole('link', { name: 'northstarmerch.com', exact: true })).toHaveAttribute('rel', 'noopener noreferrer')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      if (width > 1000) {
        const profile = await page.locator('.admin-application-profile').boundingBox()
        const review = await page.locator('.admin-application-review').boundingBox()
        expect(review.x).toBeGreaterThan(profile.x + profile.width)
        expect(Math.abs(profile.y - review.y)).toBeLessThan(2)
      }
      await page.screenshot({ path: testInfo.outputPath(`review-${mode}-${width}.png`), fullPage: true })
      await page.goto(`/admin?section=applications&application=${approvedId}`)
      await expect(page.getByRole('heading', { name: 'Verified billing status' })).toBeVisible()
      await expect(page.locator('.admin-application-commercial')).toContainText('$29.00')
      await expect(page.getByRole('button', { name: 'Approve application' })).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath(`approved-${mode}-${width}.png`), fullPage: true })
      expect(errors).toEqual([])
    })
  }
}

test('filters use the API contract, reset pagination and preserve the queue after browser back', async ({ page }) => {
  const { queries } = await setup(page)
  await page.goto('/admin?section=applications')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Next page company', { exact: true })).toBeVisible()
  expect(queries.at(-1).after).toBe('next-page')
  await page.getByRole('group', { name: 'Review status' }).getByRole('button', { name: 'Approved', exact: true }).click()
  await expect(page.getByText('Studio Forma', { exact: true })).toBeVisible()
  expect(queries.at(-1)).toEqual({ status: 'approved', limit: '20' })
  await page.getByRole('textbox', { name: 'Exact email' }).fill('JAMES@STUDIOFORMA.CO')
  await page.getByRole('button', { name: 'Find', exact: true }).click()
  await expect(page.locator('.admin-application-filter-summary')).toContainText('james@studioforma.co')
  await expect.poll(() => queries.at(-1).email).toBe('james@studioforma.co')
  await page.getByRole('button', { name: 'Open application' }).click()
  await expect(page).toHaveURL(new RegExp(`application=${approvedId}`))
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Studio Forma', exact: true })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('region', { name: 'Company applications' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Review status' }).getByRole('button', { name: 'Approved', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('textbox', { name: 'Exact email' })).toHaveValue('james@studioforma.co')
  await page.getByRole('button', { name: 'Clear email filter' }).click()
  await expect(page.getByRole('textbox', { name: 'Exact email' })).toHaveValue('')
  await expect(page.locator('.admin-application-filter-summary')).toHaveCount(0)
})

for (const decision of ['approve', 'reject']) {
  test(`${decision} keeps the existing reviewed revision and confirmation flow`, async ({ page }) => {
    const { writes } = await setup(page)
    await page.goto(`/admin?section=applications&application=${pendingId}`)
    await page.getByRole('button', { name: decision === 'approve' ? 'Approve application' : 'Request corrections', exact: true }).click()
    const dialog = page.getByRole('dialog')
    if (decision === 'reject') await dialog.getByRole('textbox', { name: 'Correction feedback' }).fill('Please confirm your company website.')
    expect(writes).toEqual([])
    await dialog.getByRole('button', { name: 'Confirm', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.locator('.admin-application-profile .admin-application-status')).toHaveText(decision === 'approve' ? 'Approved' : 'Needs corrections')
    expect(writes).toEqual([{ decision, expectedRevision: 3, ...(decision === 'reject' ? { reason: 'Please confirm your company website.' } : {}) }])
    if (decision === 'reject') await expect(page.locator('.admin-application-feedback')).toContainText('Please confirm your company website.')
  })
}

for (const type of ['percent', 'fixed']) {
  test(`offer validates fields and preserves a zero ${type} discount`, async ({ page }) => {
    const amountKey = type === 'percent' ? 'percent' : 'amountMinor'
    const draft = {
      revision: 2, status: 'draft',
      terms: { planVersion: 2, unitAmountMinor: 2900, currency: 'USD', trialMonths: 0, discount: { type, [amountKey]: 0, months: 1 } },
    }
    const { writes } = await setup(page, 'light', draft)
    await page.goto(`/admin?section=applications&application=${approvedId}`)
    await page.getByRole('button', { name: 'Edit draft offer' }).click()
    const dialog = page.getByRole('dialog')
    const amount = dialog.getByRole('spinbutton', { name: type === 'percent' ? 'Percentage' : 'Discount in USD cents' })
    const confirm = dialog.getByRole('button', { name: 'Confirm', exact: true })
    await expect(amount).toHaveValue('0')
    await dialog.getByRole('textbox', { name: 'Reason for offer' }).fill('   ')
    await amount.fill('')
    await confirm.click()
    await expect(dialog.getByText('Enter a discount amount.', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Enter a reason.', { exact: true })).toBeVisible()
    await amount.fill('-1')
    await confirm.click()
    await expect(dialog.getByText('Enter 0 or more.', { exact: true })).toBeVisible()
    await amount.fill('0.5')
    await confirm.click()
    await expect(dialog.getByText('Enter a whole number.', { exact: true })).toBeVisible()
    await amount.fill(type === 'percent' ? '101' : '2901')
    await confirm.click()
    await expect(dialog.getByText(`Enter ${type === 'percent' ? 100 : 2900} or less.`, { exact: true })).toBeVisible()
    await amount.fill('0')
    await dialog.getByRole('spinbutton', { name: 'Free calendar months' }).fill('4')
    await dialog.getByRole('spinbutton', { name: 'Discounted months' }).fill('0')
    await confirm.click()
    await expect(dialog.getByText('Enter 3 or less.', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Enter 1 or more.', { exact: true })).toBeVisible()
    expect(writes).toEqual([])
    await dialog.getByRole('spinbutton', { name: 'Free calendar months' }).fill('0')
    await dialog.getByRole('spinbutton', { name: 'Discounted months' }).fill('1')
    await dialog.getByRole('textbox', { name: 'Reason for offer' }).fill(' Standard offer ')
    await confirm.click()
    await expect(dialog).toHaveCount(0)
    expect(writes).toEqual([{
      expectedRevision: 2, planVersion: 2, trialMonths: 0,
      discount: { type, months: 1, [amountKey]: 0 }, reason: 'Standard offer',
    }])
  })
}
