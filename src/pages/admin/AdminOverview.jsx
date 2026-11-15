import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Inbox } from 'lucide-react'
import { ButtonLink } from '../../components/common/ButtonLink'
import {
  adminSections,
  adminSectionPath,
} from '../../components/admin/adminSections'

export function AdminOverview() {
  return (
    <>
      <section className="admin-welcome panel">
        <span className="admin-tool-icon" aria-hidden="true"><Inbox size={24} /></span>
        <div className="admin-welcome-copy">
          <h2>Keep new workspaces moving.</h2>
          <p className="muted">
            Review incoming applications and prepare the right offer for each business.
          </p>
        </div>
        <ButtonLink to={adminSectionPath('applications')}>
          Review applications <ArrowRight size={16} aria-hidden="true" />
        </ButtonLink>
      </section>
      <div className="admin-section-heading">
        <div>
          <h2>Your administration tools</h2>
          <p className="muted">Choose an area to pick up where you left off.</p>
        </div>
        <span className="admin-tool-count">6 areas</span>
      </div>
      <div className="admin-tool-grid">
        {adminSections
          .filter((item) => item.id !== 'overview')
          .map(({ id, label, description, Icon, group }) => (
            <Link
              className="panel admin-tool-card"
              key={id}
              to={adminSectionPath(id)}
            >
              <div className="admin-tool-top">
                <span className="admin-tool-icon">
                  <Icon size={22} aria-hidden="true" />
                </span>
                <ArrowUpRight className="muted" size={18} aria-hidden="true" />
              </div>
              <span className="eyebrow">{group}</span>
              <h3>{label}</h3>
              <p className="muted">{description}</p>
            </Link>
          ))}
      </div>
    </>
  )
}
