import assert from 'node:assert/strict'
import test from 'node:test'
import { createWorkspacePermissions, isModulePermission, modulePermissionCatalog } from '../src/services/permissions.js'

const policy = (keys = [], options = {}) => createWorkspacePermissions({
  owner: options.owner === true,
  grants: keys.map((key) => ({ key, scope: key.endsWith('.add') ? 'none' : 'all' })),
}, { writesAllowed: options.writesAllowed !== false })

test('only current four-action keys and scopes grant access, including for owners', () => {
  for (const key of ['clients.create', 'clients.history.view', 'products.pricing.cost', 'inquiries.delete', 'pricing.edit', 'constructor.edit']) {
    assert.equal(isModulePermission(key), false)
    assert.equal(policy([key], { owner: true }).can(key), false)
  }
  assert.equal(policy([], { owner: true }).can('clients.view'), false)
  assert.equal(createWorkspacePermissions({ grants: [{ key: 'clients.add', scope: 'all' }] }).can('clients.add'), false)
  assert.equal(createWorkspacePermissions({ grants: [{ key: 'clients.view', scope: 'assigned' }] }).can('clients.view'), false)
})

test('view, add, edit and delete are independent; paused billing keeps reads', () => {
  const rights = policy(['clients.view', 'clients.add', 'clients.delete'])
  assert.equal(rights.can('clients.edit'), false)
  assert.equal(rights.canWrite('clients.add'), true)
  assert.equal(rights.canWrite('clients.delete'), true)
  assert.equal(rights.canWrite('clients.view'), false)
  const paused = policy(['clients.view', 'clients.edit'], { writesAllowed: false })
  assert.equal(paused.canVisit('/app/clients'), true)
  assert.equal(paused.canWrite('clients.edit'), false)
  assert.equal(paused.canVisit('/app/clients/record/edit/'), false)
})

test('sidebar and direct routes share module, edit and owner requirements', () => {
  const viewer = policy(['clients.view'])
  assert.equal(viewer.canVisit('/app/clients/record'), true)
  assert.equal(viewer.canVisit('/app/clients/record/edit'), false)
  assert.equal(viewer.canVisit('/app/clients/record/%65dit/'), false)
  for (const path of ['/app/suppliers', '/app/team', '/app/roles', '/app/billing', '/app/decoration-matrices']) {
    assert.equal(viewer.canVisit(path), false)
  }
  assert.equal(policy(['clients.edit']).canVisit('/app/clients'), false)
  assert.equal(policy(['inquiries.view']).canVisit('/organizations/org/inquiries/record'), true)
  assert.equal(policy().canVisit('/organizations/org/inquiries/record'), false)
  assert.equal(policy(['master_data.view'], { owner: true }).canVisit('/app/decoration-matrices'), true)
})

test('Contacts require Clients View and costs require current ownership and Products View', () => {
  assert.equal(policy(['contacts.view', 'contacts.add']).can('contacts.view'), false)
  assert.equal(policy(['clients.view', 'contacts.view']).can('contacts.view'), true)
  assert.equal(policy(['products.view', 'products.edit', 'products.pricing.cost']).canViewCosts, false)
  assert.equal(policy(['products.view'], { owner: true }).canViewCosts, true)
  assert.equal(policy([], { owner: true }).canViewCosts, false)
})

test('role catalog removes obsolete actions and scopes and orders the four actions', () => {
  const entries = modulePermissionCatalog([
    { key: 'clients.delete', scopes: ['all'] },
    { key: 'clients.create', scopes: ['none'] },
    { key: 'clients.edit', scopes: ['assigned', 'all'] },
    { key: 'clients.view', scopes: ['all'] },
    { key: 'clients.add', scopes: ['none', 'all'] },
    { key: 'clients.history.view', scopes: ['all'] },
  ])
  assert.deepEqual(entries.map(({ key }) => key), ['clients.view', 'clients.add', 'clients.edit', 'clients.delete'])
  assert.deepEqual(entries.map(({ scopes }) => scopes), [['all'], ['none'], ['all'], ['all']])
})
