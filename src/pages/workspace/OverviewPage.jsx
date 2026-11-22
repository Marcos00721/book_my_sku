import {
  ArrowUpRight, Building2, Boxes, Check, CreditCard, LayoutGrid, ListTree,
  Paintbrush, Pause, ShieldCheck, Truck, UserRoundSearch, Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { Badge } from '../../components/common/Badge'
import { ButtonLink } from '../../components/common/ButtonLink'
import { Card } from '../../components/common/Card'
import { PageHeader, Status } from '../../components/workspace/Elements'
import '../../styles/overview.css'

const destinations = [
  {
    permission: 'inquiries.view', to: '/app/leads', title: 'Leads',
    description: 'Keep track of inquiries and client conversations.',
    Icon: UserRoundSearch, tone: 'teal',
  },
  {
    permission: 'clients.view', to: '/app/clients', title: 'Clients',
    description: 'Company profiles, contacts, and saved addresses.',
    Icon: Building2, tone: 'teal',
  },
  {
    permission: 'suppliers.view', to: '/app/suppliers', title: 'Suppliers',
    description: 'Your partners, their capabilities, and contact details.',
    Icon: Truck, tone: 'blue',
  },
  {
    permission: 'products.view', to: '/app/products', title: 'Products',
    description: 'Explore custom products, variants, and pricing.',
    Icon: Boxes, tone: 'blue',
  },
  {
    permission: 'master_data.view', to: '/app/master-data', title: 'Reference lists',
    description: 'Keep shared categories and workspace lists organized.',
    Icon: ListTree, tone: 'amber',
  },
  {
    permission: 'master_data.view', ownerOnly: true,
    to: '/app/decoration-matrices', title: 'Decoration matrices',
    description: 'Manage decoration methods and their pricing rules.',
    Icon: Paintbrush, tone: 'amber',
  },
]

const management = [
  { to: '/app/team', title: 'Team', description: 'People in your workspace', Icon: Users },
  { to: '/app/roles', title: 'Roles & permissions', description: 'Manage who can do what', Icon: ShieldCheck },
  { to: '/app/billing', title: 'Billing', description: 'Subscription and payments', Icon: CreditCard },
]

export function OverviewPage() {
  const workspace = useWorkspace()
  const role = workspace.owner
    ? 'Owner'
    : workspace.permissions.role?.name || 'Team member'
  const available = destinations.filter(item =>
    workspace.can(item.permission) && (!item.ownerOnly || workspace.owner),
  )
  const primary = available.find(item => item.to === '/app/clients') || available[0]

  return (
    <div className="workspace-overview">
      <Card as="section" className="overview-welcome">
        <div className="overview-welcome-heading">
          <span className="overview-workspace-icon" aria-hidden="true">
            <Building2 size={26} />
          </span>
          <Badge className="overview-role">
            <ShieldCheck size={14} aria-hidden="true" />{role}
          </Badge>
        </div>
        <PageHeader
          eyebrow="Workspace overview"
          title={workspace.organization.name}
          description="Your relationships, catalog, and team. All in one place."
          actions={primary && (
            <ButtonLink to={primary.to}>Open {primary.title.toLowerCase()}</ButtonLink>
          )}
        />
      </Card>

      <div className="overview-layout">
        <section className="overview-areas" aria-labelledby="overview-areas-title">
          <header className="overview-section-heading">
            <h2 id="overview-areas-title">Explore your workspace</h2>
            <p>Everything you need, one place to start.</p>
          </header>
          {available.length ? (
            <div className="overview-destinations">
              {available.map(({ to, title, description, Icon, tone }) => (
                <Link key={to} to={to} className={`overview-destination overview-destination--${tone}`}>
                  <div className="overview-destination-top">
                    <span className="overview-destination-icon"><Icon size={22} aria-hidden="true" /></span>
                    <ArrowUpRight size={18} className="overview-link-icon" aria-hidden="true" />
                  </div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="overview-empty">
              <LayoutGrid size={28} aria-hidden="true" />
              <h3>Your workspace is ready</h3>
              <p>Ask the owner to assign the permissions you need to get started.</p>
            </Card>
          )}
        </section>

        <aside className="overview-aside" aria-label="Workspace information">
          <Card className="overview-status-card">
            <header className="overview-section-heading">
              <h2>At a glance</h2>
              <p>The current state of your workspace.</p>
            </header>
            <dl className="overview-status-list">
              <div>
                <dt><Building2 size={17} aria-hidden="true" />Workspace</dt>
                <dd><Status value={workspace.organization.status} /></dd>
              </div>
              <div>
                <dt><CreditCard size={17} aria-hidden="true" />Billing</dt>
                <dd><Status value={workspace.access.state} /></dd>
              </div>
              <div>
                <dt><ShieldCheck size={17} aria-hidden="true" />Editing access</dt>
                <dd><Badge tone={workspace.writesAllowed ? 'success' : 'warning'}>{workspace.writesAllowed ? 'Enabled' : 'Paused'}</Badge></dd>
              </div>
            </dl>
            <div className={`overview-access-note${workspace.writesAllowed ? '' : ' overview-access-note--paused'}`}>
              {workspace.writesAllowed ? <Check size={17} aria-hidden="true" /> : <Pause size={17} aria-hidden="true" />}
              <p>{workspace.writesAllowed
                ? 'Your workspace is available. What you can edit depends on your role.'
                : workspace.owner
                  ? 'Changes are paused. Review billing to check your workspace access.'
                  : 'Changes are paused. Contact your workspace owner for help.'}</p>
            </div>
          </Card>

          {workspace.owner && (
            <Card className="overview-management" aria-labelledby="overview-management-title">
              <header className="overview-section-heading">
                <h2 id="overview-management-title">Manage workspace</h2>
                <p>Keep your team and access in order.</p>
              </header>
              <div className="overview-management-links">
                {management.map(({ to, title, description, Icon }) => (
                  <Link key={to} to={to}>
                    <Icon size={19} aria-hidden="true" />
                    <span><strong>{title}</strong><small>{description}</small></span>
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </aside>
      </div>
    </div>
  )
}
