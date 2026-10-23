import { useState } from 'react'
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import {
  ArrowUpRight,
  Building2,
  Boxes,
  ChevronDown,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  Users,
  Truck,
  X,
} from 'lucide-react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { getAuthClient } from '../../services/auth'
import { BrandMark } from '../auth/BrandMark'
import { ThemeToggle } from '../ui/ThemeToggle'
import { Action, ErrorNotice } from './Elements'

export function WorkspaceLayout() {
  const workspace = useWorkspace()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [error, setError] = useState(null)
  const links = [
    { to: '/app', label: 'Overview', Icon: LayoutDashboard, end: true },
    ...(workspace.can('clients.view')
      ? [{ to: '/app/clients', label: 'Clients', Icon: Building2 }]
      : []),
    ...(workspace.can('suppliers.view')
      ? [{ to: '/app/suppliers', label: 'Suppliers', Icon: Truck }]
      : []),
    ...(workspace.owner || workspace.can('master_data.view')
      ? [{ to: '/app/master-data', label: 'Reference lists', Icon: Boxes }]
      : []),
    ...(workspace.owner
      ? [
          { to: '/app/team', label: 'Team', Icon: Users },
          { to: '/app/roles', label: 'Roles & permissions', Icon: Shield },
          { to: '/app/billing', label: 'Billing', Icon: CreditCard },
        ]
      : []),
  ]
  async function signOut() {
    const { error } = await getAuthClient().auth.signOut()
    if (error) setError(error)
    else navigate('/login', { replace: true })
  }
  return (
    <div className="workspace-shell">
      <a className="skip-link" href="#workspace-main">
        Skip to content
      </a>
      {mobileOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`sidebar ${mobileOpen ? 'is-open' : ''}`}
        aria-label="Workspace navigation"
      >
        <div className="sidebar-brand">
          <BrandMark />
          <Action
            className="mobile-only"
            variant="icon-button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            <X size={20} />
          </Action>
        </div>
        <div className="workspace-selector">
          <span className="workspace-initial">
            {workspace.organization.name.slice(0, 1).toUpperCase()}
          </span>
          <label>
            <span className="sr-only">Switch workspace</span>
            <select
              value={workspace.organization.id}
              onChange={(event) => {
                workspace.selectOrganization(event.target.value)
                navigate('/app')
                setMobileOpen(false)
              }}
            >
              {workspace.organizations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <small>Your workspace</small>
          </label>
          <ChevronDown size={14} aria-hidden="true" />
        </div>
        {workspace.nextOrganization && (
          <Action
            variant="text-button"
            disabled={workspace.loadingOrganizations}
            onClick={workspace.loadOrganizations}
          >
            Load more workspaces
          </Action>
        )}
        <ErrorNotice error={workspace.organizationError} />
        <p className="nav-label">WORKSPACE</p>
        <nav>
          {links.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMobileOpen(false)}
            >
              <Icon size={19} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="status-dot" />A little more organized.
            <p>A lot more possible.</p>
          </div>
          <div className="account-row">
            <span className="avatar-letter">
              {workspace.session.user.email?.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>
                {workspace.owner ? 'Workspace owner' : 'Team member'}
              </strong>
              <small title={workspace.session.user.email}>
                {workspace.session.user.email}
              </small>
            </div>
            <Action
              variant="icon-button"
              aria-label="Sign out"
              onClick={signOut}
            >
              <LogOut size={18} />
            </Action>
          </div>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="topbar">
          <div className="actions">
            <Action
              className="mobile-only"
              variant="icon-button"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={21} />
            </Action>
            <span className="breadcrumb">
              Workspace <span>/</span>{' '}
              {links.find((link) =>
                link.end
                  ? location.pathname === link.to
                  : location.pathname.startsWith(link.to),
              )?.label || 'Client details'}
            </span>
          </div>
          <div className="actions">
            <span className="topbar-note">Make space for better work.</span>
            <ThemeToggle />
          </div>
        </header>
        <main id="workspace-main" className="workspace-main">
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
          <Outlet />
        </main>
        <footer className="workspace-footer">
          <span>BookMySku · A clearer day at work.</span>
          <Link to="/admin">Platform administration</Link>
        </footer>
      </div>
    </div>
  )
}
