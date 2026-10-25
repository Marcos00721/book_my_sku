import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  ChevronRight,
  LogOut,
  Menu,
  ShieldCheck,
  X,
} from 'lucide-react'
import { BrandMark } from '../auth/BrandMark'
import { ThemeToggle } from '../ui/ThemeToggle'
import { Action, ErrorNotice, PageHeader } from '../workspace/Elements'
import { useAuthSession } from '../../hooks/useAuthSession'
import { getAuthClient } from '../../services/auth'
import { adminSections, adminSectionPath } from './adminSections'
import '../../styles/admin.css'

function AdminNavigation({ section, close }) {
  return (
    <nav aria-label="Platform administration">
      {['Platform', 'Onboarding', 'Configuration'].map((group) => (
        <div className="admin-nav-group" key={group}>
          <p className="nav-label">{group}</p>
          {adminSections
            .filter((item) => item.group === group)
            .map(({ id, label, Icon }) => (
              <Link
                key={id}
                to={adminSectionPath(id)}
                aria-current={section === id ? 'page' : undefined}
                onClick={close}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
                {section === id && (
                  <ChevronRight size={14} aria-hidden="true" />
                )}
              </Link>
            ))}
        </div>
      ))}
    </nav>
  )
}

export function AdminLayout({ section, children }) {
  const drawer = useRef(null)
  const menuButton = useRef(null)
  const content = useRef(null)
  const navigate = useNavigate()
  const auth = useAuthSession()
  const [error, setError] = useState(null)
  const [signingOut, setSigningOut] = useState(false)
  const current = adminSections.find((item) => item.id === section)
  const email = auth.session?.user?.email || ''
  function closeDrawer() {
    drawer.current?.close()
    menuButton.current?.focus()
  }
  function navigateSection() {
    if (drawer.current?.open) closeDrawer()
    content.current?.focus()
  }
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
  const sidebarContents = (
    <>
      <div className="admin-brand">
        <BrandMark to="/admin" />
        {/* <span>ADMIN CONSOLE</span> */}
      </div>
      <div className="admin-scope">
        <span className="workspace-initial">
          <ShieldCheck size={20} aria-hidden="true" />
        </span>
        <div>
          <strong>Platform administration</strong>
          <small>Super administrator</small>
        </div>
      </div>
      <AdminNavigation section={section} close={navigateSection} />
      <div className="admin-sidebar-bottom">
        {/* <Link className="admin-workspace-link" to="/app">
          <ArrowUpRight size={17} aria-hidden="true" /> Open workspace
        </Link> */}
        <div className="account-row">
          <span className="avatar-letter">
            {email.slice(0, 1).toUpperCase() || 'A'}
          </span>
          <div>
            <strong>Super administrator</strong>
            <small title={email}>{email || 'Signed-in account'}</small>
          </div>
          <Action
            variant="icon-button"
            aria-label="Sign out"
            disabled={signingOut}
            onClick={signOut}
          >
            <LogOut size={17} />
          </Action>
        </div>
      </div>
    </>
  )
  return (
    <div className="workspace-shell admin-shell">
      <a className="skip-link" href="#admin-main">
        Skip to content
      </a>
      <aside className="admin-sidebar" aria-label="Admin sidebar">
        {sidebarContents}
      </aside>
      <dialog
        ref={drawer}
        className="admin-drawer"
        aria-label="Admin navigation"
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDrawer()
        }}
      >
        <Action
          variant="icon-button"
          className="admin-drawer-close"
          aria-label="Close navigation"
          onClick={closeDrawer}
        >
          <X size={20} />
        </Action>
        <div className="admin-drawer-content">{sidebarContents}</div>
      </dialog>
      <div className="workspace-body admin-body">
        <header className="topbar admin-topbar">
          <div className="actions">
            <button
              ref={menuButton}
              type="button"
              className="button icon-button mobile-only"
              aria-label="Open admin navigation"
              aria-haspopup="dialog"
              onClick={() => drawer.current.showModal()}
            >
              <Menu size={21} />
            </button>
            <span className="admin-breadcrumb">
              Administration <ChevronRight size={13} aria-hidden="true" />
              <strong>{current.label}</strong>
            </span>
          </div>
          <div className="actions">
            <span className="admin-access-label">
              <ShieldCheck size={14} aria-hidden="true" /> Platform access
            </span>
            <ThemeToggle />
          </div>
        </header>
        <main
          id="admin-main"
          ref={content}
          tabIndex={-1}
          className="workspace-main admin-main"
        >
          <PageHeader
            eyebrow="PLATFORM ADMINISTRATION"
            title={
              section === 'overview'
                ? 'A clearer view of your platform.'
                : current.label
            }
            description={
              section === 'overview'
                ? 'Welcome back. Keep new businesses moving and your platform in good shape.'
                : current.description
            }
          />
          <ErrorNotice error={error} />
          <div key={section}>{children}</div>
        </main>
        <footer className="workspace-footer">
          <span>BookMySku · Administration</span>
          <span>One place to keep things moving.</span>
        </footer>
      </div>
    </div>
  )
}
