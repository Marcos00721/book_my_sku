import { Link } from 'react-router-dom'
import { ChevronRight, LayoutDashboard, Menu, ShieldCheck } from 'lucide-react'
import { Button } from './Button'
import { Tooltip } from './Tooltip'
import { ThemeToggle } from '../ui/ThemeToggle'
import '../../styles/topbar.css'

export function AppTopbar({
  scope,
  rootLabel = 'Workspace',
  rootTo = '/app',
  pageLabel,
  Icon = LayoutDashboard,
  menuButtonRef,
  onOpenNavigation,
  admin = false,
}) {
  return (
    <div className="app-topbar-region">
      <header className={`topbar app-topbar ${admin ? 'admin-topbar' : ''}`}>
        <div className="app-topbar-leading">
          <Button
            ref={menuButtonRef}
            variant="icon"
            className="mobile-only app-topbar-menu"
            aria-label={admin ? 'Open admin navigation' : 'Open navigation'}
            aria-haspopup="dialog"
            onClick={onOpenNavigation}
          >
            <Menu size={20} aria-hidden="true" />
          </Button>
          <span className="app-topbar-page-icon" aria-hidden="true"><Icon size={20} /></span>
          <div className="app-topbar-location">
            <Tooltip content={scope}><span className="app-topbar-scope">{scope}</span></Tooltip>
            <ol className="app-topbar-breadcrumb" aria-label="Breadcrumb">
              <li><Link to={rootTo}>{rootLabel}</Link></li>
              <li aria-hidden="true"><ChevronRight size={13} /></li>
              <Tooltip content={pageLabel}><li aria-current="page">{pageLabel}</li></Tooltip>
            </ol>
          </div>
        </div>
        <div className="app-topbar-controls">
          {admin && <span className="app-topbar-access"><ShieldCheck size={14} aria-hidden="true" /> Platform access</span>}
          <ThemeToggle className="app-topbar-theme" />
        </div>
      </header>
    </div>
  )
}
