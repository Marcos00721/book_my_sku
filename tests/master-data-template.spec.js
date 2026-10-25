import { expect, test } from '@playwright/test'
import { mockSignedIn } from './helpers/auth'

const initialEntries = [
  {
    category: 'industry',
    key: 'education',
    label: 'Education',
    description: null,
    sortOrder: 0,
    status: 'active',
  },
  {
    category: 'product_category',
    key: 'drinkware',
    label: 'Drinkware',
    description: null,
    sortOrder: 0,
    status: 'active',
  },
  {
    category: 'decoration_method',
    key: 'screen_print',
    label: 'Screen printing',
    description: null,
    sortOrder: 0,
    status: 'active',
  },
]

test.beforeEach(async ({ page }) => {
  await mockSignedIn(page)
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
})

async function mockTemplates(page, { interruptFirst = false } = {}) {
  let draft = {
    revision: 4,
    version: 2,
    entries: structuredClone(initialEntries),
  }
  const writes = []
  const publications = []
  await page.route('**/api/v1/**', (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path.endsWith('/admin/me'))
      return route.fulfill({ json: { data: { role: 'super_admin' } } })
    if (path.endsWith('/master-data/draft')) {
      if (request.method() === 'PUT') {
        writes.push({
          body: request.postDataJSON(),
          key: request.headers()['idempotency-key'],
        })
        if (interruptFirst && writes.length === 1)
          return route.fulfill({
            status: 503,
            json: {
              error: {
                code: 'SERVICE_UNAVAILABLE',
                message: 'Please retry the original save.',
              },
            },
          })
        draft = {
          ...draft,
          entries: request.postDataJSON().entries,
          revision: draft.revision + 1,
        }
      }
      return route.fulfill({ json: { data: draft } })
    }
    if (path.endsWith('/master-data/publish'))
      publications.push(request.postDataJSON())
    return route.fulfill({ json: { data: { items: [], next: null } } })
  })
  return { writes, publications }
}

test('entry forms save the chosen category without publishing or replacing other categories', async ({
  page,
}) => {
  const { writes, publications } = await mockTemplates(page)
  await page.goto('/admin?section=masterData')
  await page.getByRole('button', { name: 'Add entry', exact: true }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Cancelled entry')
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(writes).toHaveLength(0)
  await page.getByRole('button', { name: 'Add entry', exact: true }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('Category').selectOption('decoration_method')
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('  Laser engraving  ')
  await dialog.getByRole('button', { name: 'Save to draft' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('tabpanel')).toContainText('Laser engraving')
  expect(writes[0].body.expectedRevision).toBe(4)
  expect(writes[0].body.entries).toEqual(expect.arrayContaining(initialEntries))
  expect(writes[0].body.entries).toContainEqual({
    category: 'decoration_method',
    key: 'laser_engraving',
    label: 'Laser engraving',
    description: null,
    sortOrder: 0,
    status: 'active',
  })
  expect(publications).toHaveLength(0)
  await page.getByRole('button', { name: 'Edit Laser engraving' }).click()
  await page
    .getByRole('dialog')
    .getByRole('textbox', { name: 'Name', exact: true })
    .fill('Laser marking')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Save to draft' })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(writes[1].body.expectedRevision).toBe(5)
  expect(writes[1].body.entries).toHaveLength(4)
  expect(
    writes[1].body.entries.find((entry) => entry.key === 'laser_engraving')
      .label,
  ).toBe('Laser marking')
})

test('an interrupted dialog save locks its draft and retries the original operation', async ({
  page,
}) => {
  const { writes } = await mockTemplates(page, { interruptFirst: true })
  await page.goto('/admin?section=masterData')
  await page.getByRole('button', { name: 'Add entry', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Healthcare')
  await dialog.getByRole('button', { name: 'Save to draft' }).click()
  await expect(
    dialog.getByRole('button', { name: 'Retry same request' }),
  ).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: 'Name', exact: true })).toBeDisabled()
  await expect(
    dialog.getByRole('button', { name: 'Cancel', exact: true }),
  ).toBeDisabled()
  await dialog.getByRole('button', { name: 'Retry same request' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(writes).toHaveLength(2)
  expect(writes[1]).toEqual(writes[0])
  expect(writes[0].key).toMatch(/^[a-f\d-]{36}$/)
})

