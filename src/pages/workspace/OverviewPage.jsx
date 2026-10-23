import {
  ArrowRight,
  Building2,
  CreditCard,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { PageHeader, Status } from '../../components/workspace/Elements'

export function OverviewPage() {
  const workspace = useWorkspace()
  return (
    <>
      <PageHeader
        eyebrow="A LITTLE CLARITY FOR YOUR DAY"
        title="Good work starts here."
        description={`Welcome to ${workspace.organization.name}. Your people and relationships, together in one place.`}
      />
      <section className="welcome-panel">
        <div>
          <span className="eyebrow">ROOM TO GROW</span>
          <h2>
            Less busywork.
            <br />
            More meaningful connections.
          </h2>
          <p>
            Keep client details close, bring your team together, and move your
            business forward.
          </p>
          {workspace.can('clients.view') && (
            <Link className="button" to="/app/clients">
              Open client directory <ArrowRight size={17} />
            </Link>
          )}
        </div>
        <div className="welcome-symbol" aria-hidden="true">
          <Building2 size={90} strokeWidth={1} />
          <span>
            <ShieldCheck size={25} />
          </span>
        </div>
      </section>
      <div className="overview-grid">
        <section className="panel">
          <div className="section-heading">
            <h2>Workspace at a glance</h2>
            <ShieldCheck size={20} className="muted" />
          </div>
          <dl className="detail-list">
            <div>
              <dt>Workspace</dt>
              <dd>{workspace.organization.name}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <Status value={workspace.organization.status} />
              </dd>
            </div>
            <div>
              <dt>Billing access</dt>
              <dd>
                <Status value={workspace.access.state} />
              </dd>
            </div>
            <div>
              <dt>Your role</dt>
              <dd>
                {workspace.owner
                  ? 'Owner'
                  : workspace.permissions.role?.name || 'Team member'}
              </dd>
            </div>
          </dl>
        </section>
        <section className="panel">
          <h2>Your next step</h2>
          <div className="quick-links">
            {workspace.can('clients.view') && (
              <Link to="/app/clients">
                <Building2 size={21} />
                <span>
                  <strong>Build your client relationships</strong>
                  <small>Companies, contacts, and saved addresses.</small>
                </span>
                <ArrowRight size={18} />
              </Link>
            )}
            {workspace.owner && (
              <>
                <Link to="/app/team">
                  <Users size={21} />
                  <span>
                    <strong>Bring your team together</strong>
                    <small>Invite people and manage their access.</small>
                  </span>
                  <ArrowRight size={18} />
                </Link>
                <Link to="/app/billing">
                  <CreditCard size={21} />
                  <span>
                    <strong>Keep your workspace moving</strong>
                    <small>Review subscription and payment status.</small>
                  </span>
                  <ArrowRight size={18} />
                </Link>
              </>
            )}
            {!workspace.can('clients.view') && !workspace.owner && (
              <p className="muted">
                Your workspace is ready. Ask your owner to assign the
                permissions you need.
              </p>
            )}
          </div>
        </section>
      </div>
    </>
  )
}
