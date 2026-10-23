import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuthSession } from '../../hooks/useAuthSession'
import { WorkspaceContext } from '../../hooks/WorkspaceContext'
import { useResource } from '../../hooks/useResource'
import {
  clearMutationIntents,
  queryPath,
  readData,
} from '../../services/workspace'
import { Action, Empty, ErrorNotice, Loading } from './Elements'
import { ThemeToggle } from '../ui/ThemeToggle'
import { BrandMark } from '../auth/BrandMark'
import { getAuthClient } from '../../services/auth'

export function WorkspaceProvider({ children }) {
  const auth = useAuthSession()
  useEffect(() => {
    clearMutationIntents()
    return clearMutationIntents
  }, [auth.session?.user?.id])
  if (auth.loading) return <Loading />
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
  const access = useResource(base ? `${base}/access` : null)
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
  if (organizations.loading) return <Loading />
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
            <Link className="button secondary" to="/admin">
              Platform administration
            </Link>
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
                <Link className="button" to="/setup">
                  Continue workspace setup
                </Link>
                <Link className="button secondary" to="/register">
                  Application status
                </Link>
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
    return <Loading label="Checking workspace access…" />
  const error = permissions.error || access.error
  if (error)
    return (
      <div className="setup-layout">
        <ErrorNotice error={error} retry={refreshAccess} />
        <Link className="button secondary" to="/login">
          Back to sign in
        </Link>
      </div>
    )
  const owner = permissions.data?.owner === true
  const can = (key) =>
    permissions.data?.grants?.some((grant) => grant.key === key) === true
  const value = {
    session,
    organization,
    organizations: items,
    selectOrganization: setSelectedId,
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
