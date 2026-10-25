import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Inbox, ShieldCheck } from 'lucide-react'
import {
  adminSections,
  adminSectionPath,
} from '../../components/admin/adminSections'

export function AdminOverview() {
  return (
    <>
      <section className="admin-welcome panel">
        <div>
          <span className="eyebrow">MAKE THE NEXT STEP COUNT</span>
          <h2>
            Every great workspace
            <br />
            starts with a good welcome.
          </h2>
          <p className="muted">
            Review incoming applications, shape the right offer, and help each
            business get started.
          </p>
          <Link className="button" to={adminSectionPath('applications')}>
            Review applications <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <div className="admin-welcome-art" aria-hidden="true">
          <Inbox size={62} strokeWidth={1.2} />
          <span>
            <ShieldCheck size={23} />
          </span>
        </div>
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
              <span className="admin-tool-open">
                Open {label.toLowerCase()}{' '}
                <ArrowRight size={14} aria-hidden="true" />
              </span>
            </Link>
          ))}
      </div>
    </>
  )
}
