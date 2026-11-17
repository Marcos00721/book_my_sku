import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil } from 'lucide-react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useResource } from '../../hooks/useResource'
import { ButtonLink } from '../../components/common/ButtonLink'
import { TextLink } from '../../components/common/TextLink'
import {
  ErrorNotice,
  Loading,
  PermissionDenied,
  StickyPageChrome,
} from '../../components/workspace/Elements'
import { ClientAddresses } from './ClientAddresses'
import { ClientActivity } from './ClientActivity'
import { ClientManagement } from './ClientManagement'
import { ClientContacts } from './ClientContacts'

export function ClientDetailPage() {
  const workspace = useWorkspace()
  const { clientId } = useParams()
  if (!workspace.can('clients.view')) return <PermissionDenied />
  return (
    <ClientRecord
      key={clientId}
      path={`${workspace.base}/clients/${encodeURIComponent(clientId)}`}
    />
  )
}

function ClientRecord({ path }) {
  const workspace = useWorkspace()
  const resource = useResource(path)
  const location = useLocation()
  const navigate = useNavigate()
  const [flash] = useState(location.state?.flash || '')
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    if (!location.state?.flash) return
    navigate(location.pathname, { replace: true, state: {} })
  }, [location.pathname, location.state, navigate])

  if (resource.loading) return <Loading variant="detail" label="Loading client…" backTo="/app/clients" backLabel="Back to clients" />
  if (resource.error)
    return <ErrorNotice error={resource.error} retry={resource.reload} />
  const client = resource.data
  const tabItems = [
    { value: 'overview', label: 'Overview' },
    { value: 'contacts', label: 'Contacts' },
    { value: 'addresses', label: 'Saved addresses' },
    ...(workspace.can('clients.history.view')
      ? [{ value: 'activity', label: 'Activity' }]
      : []),
  ]
  const activeTabLabel =
    tabItems.find((item) => item.value === tab)?.label || 'Overview'

  return (
    <StickyPageChrome
      className="client-detail-page"
      before={
        <>
          <TextLink to="/app/clients" className="back-link">
            <ArrowLeft size={16} />
            Back to clients
          </TextLink>
          {flash ? (
            <p className="client-flash notice" role="status">
              {flash}
            </p>
          ) : null}
        </>
      }
      title={client.name}
      description={[client.clientCode, client.accountLabel].filter(Boolean).join(' · ') || undefined}
      actions={
        workspace.can('clients.edit') &&
        workspace.writesAllowed &&
        client.status !== 'archived' && (
          <ButtonLink
            variant="secondary"
            className="client-profile-edit"
            aria-label="Edit client"
            to={`/app/clients/${client._id}/edit`}
          >
            <Pencil size={15} />
            <span className="client-profile-edit-label">Edit</span>
          </ButtonLink>
        )
      }
      tabs={{
        label: 'Client information',
        value: tab,
        onChange: setTab,
        items: tabItems,
      }}
    >
      <section className="panel" role="tabpanel" aria-label={activeTabLabel}>
        {tab === 'overview' ? (
          <ClientManagement
            path={path}
            client={client}
            reload={resource.reload}
          />
        ) : tab === 'contacts' ? (
          <ClientContacts
            path={`${path}/contacts`}
            archived={client.status === 'archived'}
            reloadClient={resource.reload}
          />
        ) : tab === 'activity' ? (
          <ClientActivity
            key={String(workspace.can('contacts.view'))}
            path={path}
          />
        ) : (
          <ClientAddresses
            path={path}
            client={client}
            reloadClient={resource.reload}
          />
        )}
      </section>
    </StickyPageChrome>
  )
}
