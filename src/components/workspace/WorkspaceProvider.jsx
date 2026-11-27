import { lazy, useCallback, useEffect, useRef, useState } from 'react'
import { Provider } from 'react-redux'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuthSession } from '../../hooks/useAuthSession'
import { WorkspaceContext } from '../../hooks/WorkspaceContext'
import { useResource } from '../../hooks/useResource'
import {
  clearMutationIntents,
  mutate,
  queryPath,
  readData,
} from '../../services/workspace'
import { Action, Empty, ErrorNotice } from './Elements'
import { PageLoader } from '../common/Loader'
import { ButtonLink } from '../common/ButtonLink'
import { ThemeToggle } from '../ui/ThemeToggle'
import { BrandMark } from '../auth/BrandMark'
import { getAuthClient } from '../../services/auth'
import { createWorkspacePermissions } from '../../services/permissions'
import { createWorkspaceStore } from '../../store'

const WorkspaceLoginPage = lazy(() => import('../../pages/LoginPage').then(page => ({ default: page.LoginPage })))

export function WorkspaceProvider({ children, keepLoginDestination = false }) {
  const auth = useAuthSession()
  const location = useLocation()
  useEffect(() => {
    clearMutationIntents()
    return clearMutationIntents
  }, [auth.session?.user?.id])
  if (auth.loading) return <PageLoader label="Checking your session…" />
  if (auth.error) return <ErrorNotice error={auth.error} />
  if (!auth.session) return keepLoginDestination
    ? <WorkspaceLoginPage returnTo={location.pathname} />
    : <Navigate to="/login" replace />
  if (!auth.session.user.email_confirmed_at)
    return <Navigate to="/register" replace />
  return (
    <WorkspaceSession key={auth.session.user.id} session={auth.session}>
      {children}
    </WorkspaceSession>
  )
}

function WorkspaceSession({ session, children }) {
  const { organizationId: linkedOrganizationId } = useParams()
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState(linkedOrganizationId || null)
  const [lastLinkedId, setLastLinkedId] = useState(linkedOrganizationId)
  // Remember a linked workspace when navigation returns to ordinary app routes.
  if (linkedOrganizationId !== lastLinkedId) {
    setLastLinkedId(linkedOrganizationId)
    if (linkedOrganizationId) setSelectedId(linkedOrganizationId)
  }
  const [cursor, setCursor] = useState(null)
  const [extra, setExtra] = useState([])
  const [pageError, setPageError] = useState(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const organizations = useResource('/organizations')
  const items = [...(organizations.data?.items || []), ...extra]
  const organization = linkedOrganizationId
    ? items.find((item) => item.id === linkedOrganizationId)
    : items.find((item) => item.id === selectedId) ||
    items.find((item) => item.status === 'active') ||
    items[0]
  const base =
    organization?.status === 'active'
      ? `/organizations/${organization.id}`
      : null
  const permissions = useResource(base ? `${base}/permissions` : null)
  const owner = permissions.data?.owner === true
  const billingSyncs = useRef(new Map())
  // Resolve expired billing evidence before publishing access. Background checks
  // retain the current UI until the final result, rather than hiding every write
  // action for the duration of an otherwise successful billing refresh.
  const loadAccess = useCallback(async (path, options) => {
    const current = await readData(path, options)
    if (!owner || current.writesAllowed === true || current.nextAction !== 'refresh_billing')
      return current
    let sync = billingSyncs.current.get(path)
    if (!sync?.promise) {
      if (sync && Date.now() - sync.startedAt < 60_000) return current
      sync = { startedAt: Date.now(), promise: null }
      sync.promise = (async () => {
        const me = await readData('/onboarding/me')
        const applicationId = me?.application?.id
        if (applicationId) {
          await mutate(
            'post',
            `/applications/${applicationId}/billing/refresh`,
            {},
            { idempotent: false },
          )
        }
      })().finally(() => { sync.promise = null })
      billingSyncs.current.set(path, sync)
    }
    try {
      await sync.promise
      return await readData(path, options)
    } catch {
      // A failed verification must still publish the server's denied access.
      return current
    }
  }, [owner])
  const access = useResource(
    base && permissions.data ? `${base}/access` : null,
    { load: loadAccess },
  )
  const reloadPermissions = permissions.reload
  const reloadAccess = access.reload
  const refreshAccess = useCallback(() => {
    reloadPermissions()
    reloadAccess()
  }, [reloadPermissions, reloadAccess])
  useEffect(() => {
    window.addEventListener('workspace-access-changed', refreshAccess)
    window.addEventListener('focus', refreshAccess)
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshAccess()
    }, 60_000)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('workspace-access-changed', refreshAccess)
      window.removeEventListener('focus', refreshAccess)
    }
  }, [refreshAccess])
  async function loadMore() {
    setLoadingMore(true)
    setPageError(null)
    try {
      const page = await readData(
        queryPath('/organizations', {
          after: cursor || organizations.data?.next,
        }),
      )
      setExtra((current) => [
        ...new Map(
          [...current, ...page.items].map((item) => [item.id, item]),
        ).values(),
      ])
      setCursor(page.next || '')
    } catch (error) {
      setPageError(error)
    } finally {
      setLoadingMore(false)
    }
  }
  if (organizations.loading) return <PageLoader />
  if (organizations.error)
    return (
      <ErrorNotice error={organizations.error} retry={organizations.reload} />
    )
  const next = cursor === null ? organizations.data?.next : cursor
  if (!base)
    return (
      <div className="setup-layout">
        <header className="setup-top">
          <BrandMark />
          <div className="actions">
            <ThemeToggle />
          </div>
        </header>
        <section className="panel">
          <Empty
            title={
              organization
                ? 'Your workspace is being prepared'
                : linkedOrganizationId ? 'Linked workspace unavailable' : 'Let’s get you settled in'
            }
            action={
              <div className="actions">
                <ButtonLink to="/setup">Continue workspace setup</ButtonLink>
                <ButtonLink variant="secondary" to="/register">
                  Application status
                </ButtonLink>
              </div>
            }
          >
            {linkedOrganizationId
              ? 'The linked workspace must be available in your account. Load more workspaces if it is on a later page.'
              : 'Existing team members can open their invitation link. Workspace owners can continue their application and setup here.'}
          </Empty>
          {items.length > 0 && !linkedOrganizationId && (
            <FieldlessSelector
              items={items}
              selected={organization.id}
              onChange={setSelectedId}
            />
          )}
          {next && (
            <Action onClick={loadMore} disabled={loadingMore}>
              Load more workspaces
            </Action>
          )}
          <ErrorNotice error={pageError} />
          <Action
            variant="secondary"
            onClick={async () => {
              await getAuthClient().auth.signOut()
            }}
          >
            Sign out
          </Action>
        </section>
      </div>
    )
  if (permissions.loading || access.loading)
    return <PageLoader label="Checking your workspace access…" />
  const error = permissions.error || access.error
  if (error)
    return (
      <div className="setup-layout">
        <ErrorNotice error={error} retry={refreshAccess} />
        <ButtonLink variant="secondary" to="/login">
          Back to sign in
        </ButtonLink>
      </div>
    )
  const policy = createWorkspacePermissions(permissions.data, access.data)
  // Drop open forms and protected read results when authority changes. Ordinary
  // background refreshes preserve the UI when the effective access is unchanged.
  const permissionKey = JSON.stringify([
    organization.id, owner, access.data?.writesAllowed === true,
    (permissions.data?.grants || []).map(({ key, scope }) => `${key}:${scope}`).sort(),
  ])
  const value = {
    session,
    organization,
    organizations: items,
    selectOrganization: (id) =>
      new Promise((resolve) => {
        const event = new CustomEvent('workspace-before-switch', {
          cancelable: true,
          detail: {
            proceed: () => {
              setSelectedId(id)
              if (linkedOrganizationId && id !== linkedOrganizationId) navigate('/app/leads')
              resolve(true)
            },
            cancel: () => resolve(false),
          },
        })
        if (!window.dispatchEvent(event)) return
        setSelectedId(id)
        if (linkedOrganizationId && id !== linkedOrganizationId) navigate('/app/leads')
        resolve(true)
      }),
    base,
    owner,
    ...policy,
    permissions: permissions.data,
    access: access.data,
    writesAllowed: access.data?.writesAllowed === true,
    refreshAccess,
    nextOrganization: next,
    loadOrganizations: loadMore,
    loadingOrganizations: loadingMore,
    organizationError: pageError,
  }
  return (
    <WorkspaceContext.Provider value={value}>
      <WorkspaceContent key={permissionKey}>{children}</WorkspaceContent>
    </WorkspaceContext.Provider>
  )
}

function WorkspaceContent({ children }) {
  // Each account/workspace/permission set gets its own cache. Late requests from
  // a previous workspace can only update that workspace's discarded store.
  const [store] = useState(createWorkspaceStore)
  return <Provider store={store}>{children}</Provider>
}

function FieldlessSelector({ items, selected, onChange }) {
  return (
    <label className="field">
      <span>Workspace</span>
      <select
        value={selected}
        onChange={(event) => onChange(event.target.value)}
      >
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name} ({item.status})
          </option>
        ))}
      </select>
    </label>
  )
}
