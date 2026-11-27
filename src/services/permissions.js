export const permissionActions = ['view', 'add', 'edit', 'delete']
export const permissionLabels = { view: 'View', add: 'Add', edit: 'Edit', delete: 'Delete' }
const moduleActions = {
  clients: permissionActions,
  contacts: permissionActions,
  suppliers: permissionActions,
  products: permissionActions,
  mail: permissionActions,
  inquiries: ['view', 'add', 'edit'],
  projects: ['view', 'add', 'edit'],
  sage: ['view', 'add', 'edit'],
  master_data: ['view'],
  diagnostics: ['view'],
}

// Permission names and scopes come from the backend's four-action contract.
export function isModulePermission(key) {
  if (typeof key !== 'string') return false
  const [module, action, extra] = key.split('.')
  return Boolean(Object.hasOwn(moduleActions, module) && moduleActions[module].includes(action) && extra === undefined)
}

export function modulePermissionCatalog(items = []) {
  return items.filter(({ key }) => isModulePermission(key)).map((entry) => ({
    ...entry,
    scopes: (entry.scopes || []).filter((scope) => scope === (entry.key.endsWith('.add') ? 'none' : 'all')),
  })).sort((a, b) => a.key.split('.')[0].localeCompare(b.key.split('.')[0]) ||
    permissionActions.indexOf(a.key.split('.')[1]) - permissionActions.indexOf(b.key.split('.')[1]))
}

const routeModules = {
  leads: 'inquiries',
  clients: 'clients',
  suppliers: 'suppliers',
  products: 'products',
  'master-data': 'master_data',
}

// One policy for navigation, direct URLs, tabs and actions. Owner status never
// substitutes for an enabled grant; the server returns owners' effective grants.
export function createWorkspacePermissions(permissions, access) {
  const grants = new Set((permissions?.grants || [])
    .filter(({ key, scope }) => isModulePermission(key) && scope === (key.endsWith('.add') ? 'none' : 'all'))
    .map(({ key }) => key))
  const owner = permissions?.owner === true
  const can = (key) => grants.has(key) && (!key.startsWith('contacts.') || grants.has('clients.view'))
  const canWrite = (key) => can(key) && !key.endsWith('.view') && access?.writesAllowed === true
  function canVisit(pathname) {
    try { pathname = decodeURIComponent(pathname) } catch { return false }
    pathname = pathname.replace(/\/+$/, '')
    if (/^\/organizations\/[^/]+\/inquiries\/[^/]+\/?$/.test(pathname)) return can('inquiries.view')
    const [, app, section, ...parts] = pathname.split('/')
    if (app !== 'app') return false
    if (!section) return true
    if (['team', 'roles', 'billing'].includes(section)) return owner
    if (section === 'decoration-matrices') return owner && can('master_data.view')
    const module = routeModules[section]
    if (!module || !can(`${module}.view`)) return false
    return parts.at(-1) !== 'edit' || canWrite(`${module}.edit`)
  }
  return { can, canWrite, canVisit, canViewCosts: owner && can('products.view') }
}
