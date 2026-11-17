import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
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

export function WorkspaceProvider({ children }) {
  const auth = useAuthSession()
  useEffect(() => {
    clearMutationIntents()
    return clearMutationIntents
  }, [auth.session?.user?.id])
  if (auth.loading) return <PageLoader label="Checking your session…" />
  if (auth.error) return <ErrorNotice error={auth.error} />
  if (!auth.session) return <Navigate to="/login" replace />
  if (!auth.session.user.email_confirmed_at)
    return <Navigate to="/register" replace />
  return (
    <WorkspaceSession key={auth.session.user.id} session={auth.session}>
      {children}
    </WorkspaceSession>
  )
}

function WorkspaceSession({ session, children }) {
  const [selectedId, setSelectedId] = useState(null)
  const [cursor, setCursor] = useState(null)
  const [extra, setExtra] = useState([])
  const [pageError, setPageError] = useState(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const organizations = useResource('/organizations')
  const items = [...(organizations.data?.items || []), ...extra]
  const organization =
    items.find((item) => item.id === selectedId) ||
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
    return () => {
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
                : 'Let’s get you settled in'
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
            Existing team members can open their invitation link. Workspace
            owners can continue their application and setup here.
          </Empty>
          {items.length > 0 && (
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
  const can = (key) =>
    permissions.data?.grants?.some((grant) => grant.key === key) === true
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
              resolve(true)
            },
            cancel: () => resolve(false),
          },
        })
        if (!window.dispatchEvent(event)) return
        setSelectedId(id)
        resolve(true)
      }),
    base,
    owner,
    can,
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
      <div key={organization.id}>{children}</div>
    </WorkspaceContext.Provider>
  )
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
