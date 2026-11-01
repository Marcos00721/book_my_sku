import { ArrowRight, Building2, CreditCard, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { PageHeader, Status } from '../../components/workspace/Elements'

export function OverviewPage() {
  const workspace = useWorkspace()
  const role = workspace.owner
    ? 'Owner'
    : workspace.permissions.role?.name || 'Team member'
  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title={workspace.organization.name}
        description="Clients, suppliers, and the people in this workspace."
      />
      <section className="metric-row" aria-label="Workspace summary">
        <article className="metric">
          <span>Status</span>
          <strong>
            <Status value={workspace.organization.status} />
          </strong>
        </article>
        <article className="metric">
          <span>Billing</span>
          <strong>
            <Status value={workspace.access.state} />
          </strong>
        </article>
        <article className="metric">
          <span>Your role</span>
          <strong>{role}</strong>
        </article>
        <article className="metric">
          <span>Changes</span>
          <strong>{workspace.writesAllowed ? 'Open' : 'Paused'}</strong>
        </article>
      </section>
      <section className="panel">
        <div className="section-heading">
          <h2>Continue</h2>
        </div>
        <div className="quick-links">
          {workspace.can('clients.view') && (
            <Link to="/app/clients">
              <Building2 size={16} />
              <span>
                <strong>Clients</strong>
                <small>Companies, contacts, and saved addresses.</small>
              </span>
              <ArrowRight size={16} />
            </Link>
          )}
          {workspace.owner && (
            <>
              <Link to="/app/team">
                <Users size={16} />
                <span>
                  <strong>Team</strong>
                  <small>People and the access they have.</small>
                </span>
                <ArrowRight size={16} />
              </Link>
              <Link to="/app/billing">
                <CreditCard size={16} />
                <span>
                  <strong>Billing</strong>
                  <small>Subscription and payment status.</small>
                </span>
                <ArrowRight size={16} />
              </Link>
            </>
          )}
          {!workspace.can('clients.view') && !workspace.owner && (
            <p className="muted">
              Your workspace is ready. Ask the owner to assign the permissions
              you need.
            </p>
          )}
        </div>
      </section>
    </>
  )
}
