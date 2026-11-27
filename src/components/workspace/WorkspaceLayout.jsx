import { Suspense, useRef, useState } from 'react'
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import {
  ArrowUpRight,
  Building2,
  Boxes,
  CreditCard,
  LayoutDashboard,
  ListTree,
  Paintbrush,
  Shield,
  UserRoundSearch,
  Users,
  Truck,
} from 'lucide-react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { getAuthClient } from '../../services/auth'
import { GlassSidebar } from '../common/GlassSidebar'
import { AppTopbar } from '../common/AppTopbar'
import { QuickCreate } from './QuickCreate'
import { Action, ErrorNotice, ListSkeleton, Loading, PermissionDenied } from './Elements'

export function WorkspaceLayout() {
  const workspace = useWorkspace()
  const navigate = useNavigate()
  const location = useLocation()
  const drawer = useRef(null)
  const menuButton = useRef(null)
  const content = useRef(null)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState(null)
  const isListRoute = /^\/app\/(leads|clients|suppliers|products|master-data|decoration-matrices|team|roles)\/?$/.test(location.pathname)
  const loadingVariant = location.pathname.endsWith('/edit')
    ? 'form'
    : /^\/app\/(leads|clients|suppliers|products|decoration-matrices)\/.+/.test(location.pathname)
      ? 'detail'
      : 'page'
  const links = [
    { to: '/app', label: 'Overview', Icon: LayoutDashboard, end: true },
    { to: '/app/leads', label: 'Leads', Icon: UserRoundSearch },
    { to: '/app/clients', label: 'Clients', Icon: Building2 },
    { to: '/app/suppliers', label: 'Suppliers', Icon: Truck },
    { to: '/app/products', label: 'Products', Icon: Boxes },
    { to: '/app/master-data', label: 'Reference lists', Icon: ListTree },
    { to: '/app/decoration-matrices', label: 'Decoration matrices', Icon: Paintbrush },
    { to: '/app/team', label: 'Team', Icon: Users },
    { to: '/app/roles', label: 'Roles & permissions', Icon: Shield },
    { to: '/app/billing', label: 'Billing', Icon: CreditCard },
  ].filter((link) => workspace.canVisit(link.to))
  const activeLinks = links.map((link) => ({
    ...link,
    active: link.end
      ? location.pathname === link.to
      : location.pathname === link.to || location.pathname.startsWith(link.to + '/'),
  }))
  const groups = [
    { label: 'Overview', paths: ['/app'] },
    { label: 'Relationships', paths: ['/app/leads', '/app/clients', '/app/suppliers'] },
    { label: 'Catalog', paths: ['/app/products', '/app/decoration-matrices'] },
    { label: 'Workspace', paths: ['/app/master-data', '/app/team', '/app/roles', '/app/billing'] },
  ].map(({ label, paths }) => ({ label, items: activeLinks.filter((link) => paths.includes(link.to)) }))
  async function signOut() {
    setSigningOut(true)
    setError(null)
    try {
      const { error } = await getAuthClient().auth.signOut()
      if (error) throw error
      navigate('/login', { replace: true })
    } catch (failure) {
      setError(failure)
    } finally {
      setSigningOut(false)
    }
  }
  return (
    <div className="workspace-shell has-glass-sidebar">
      <a className="skip-link" href="#workspace-main">
        Skip to content
      </a>
      <GlassSidebar
        groups={groups}
        brandTo="/app"
        email={workspace.session.user.email || ''}
        role={workspace.owner ? 'Owner' : workspace.permissions?.role?.name || 'Team member'}
        signOut={signOut}
        signingOut={signingOut}
        drawerRef={drawer}
        menuButtonRef={menuButton}
        mainRef={content}
      >
        {workspace.nextOrganization && (
          <Action variant="text-button" disabled={workspace.loadingOrganizations} onClick={workspace.loadOrganizations}>
            Load more workspaces
          </Action>
        )}
        <ErrorNotice error={workspace.organizationError} />
      </GlassSidebar>
      <div className="workspace-body">
        <AppTopbar
          scope={workspace.organization.name}
          pageLabel={activeLinks.find((link) => link.active)?.label || 'Workspace'}
          Icon={activeLinks.find((link) => link.active)?.Icon || LayoutDashboard}
          menuButtonRef={menuButton}
          onOpenNavigation={() => drawer.current.showModal()}
          actions={<>
            {workspace.organizations.length > 1 && <select
              aria-label="Switch workspace"
              value={workspace.organization.id}
              onChange={(event) => { void workspace.selectOrganization(event.target.value) }}
            >
              {workspace.organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
            </select>}
            <QuickCreate key={`${workspace.base}:${location.key}`} />
          </>}
        />
        <main id="workspace-main" ref={content} tabIndex={-1} className="workspace-main">
          <ErrorNotice error={error} />
          {!workspace.writesAllowed && (
            <div className="notice billing-notice">
              <CreditCard size={19} aria-hidden="true" />
              <p>
                Workspace changes are paused.{' '}
                {workspace.owner
                  ? 'Review billing to restore access.'
                  : 'Contact your workspace owner for help.'}
              </p>
              {workspace.owner && (
                <Link to="/app/billing">
                  Review billing <ArrowUpRight size={15} />
                </Link>
              )}
            </div>
          )}
          <Suspense
            fallback={
              isListRoute
                ? <ListSkeleton label="Loading list…" />
                : <Loading variant={loadingVariant} />
            }
          >
            {workspace.canVisit(location.pathname) ? <Outlet /> : <PermissionDenied />}
          </Suspense>
        </main>
        <footer className="workspace-footer">
          <span>BookMySku</span>
        </footer>
      </div>
    </div>
  )
}
