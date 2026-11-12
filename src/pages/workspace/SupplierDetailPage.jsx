import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useMutation } from '../../hooks/useMutation'
import { useResource } from '../../hooks/useResource'
import { useSuppliers } from '../../hooks/useSuppliers'
import { TextLink } from '../../components/common/TextLink'
import { SupplierEditor } from '../../components/suppliers/SupplierEditor'
import { SupplierChildrenPanel } from '../../components/suppliers/SupplierChildrenPanel'
import { SupplierDefaultsPanel } from '../../components/suppliers/SupplierDefaultsPanel'
import {
  Action,
  ErrorNotice,
  Loading,
  PermissionDenied,
  StickyPageChrome,
} from '../../components/workspace/Elements'
import { MutationRetry } from '../../components/workspace/RecordTools'
import { SupplierOverview } from './SupplierOverview'
import { SupplierActivity } from './SupplierActivity'

export function SupplierDetailPage() {
  const workspace = useWorkspace()
  const { supplierId } = useParams()
  if (!workspace.can('suppliers.view')) return <PermissionDenied />
  return (
    <SupplierRecord
      key={supplierId}
      base={`${workspace.base}/suppliers/${encodeURIComponent(supplierId)}`}
    />
  )
}

function SupplierRecord({ base }) {
  const workspace = useWorkspace()
  const resource = useResource(base)
  const { saveSupplier } = useSuppliers({ autoFetch: false })
  const [tab, setTab] = useState('contacts')
  const [editing, setEditing] = useState(false)
  const mutation = useMutation()

  if (resource.loading) return <Loading label="Loading supplier…" />
  if (resource.error)
    return <ErrorNotice error={resource.error} retry={resource.reload} />

  const supplier = resource.data
  const canEdit =
    workspace.can('suppliers.edit') &&
    workspace.writesAllowed &&
    supplier.status === 'active'

  async function lifecycle() {
    const action = supplier.status === 'active' ? 'archive' : 'restore'
    if (
      !window.confirm(
        `${action === 'archive' ? 'Archive' : 'Restore'} ${supplier.name}? Existing history remains. Defaults are not restored automatically.`,
      )
    )
      return
    if (
      await mutation.run('post', `${base}/${action}`, {
        expectedRevision: supplier.revision,
      })
    ) {
      resource.reload()
    }
  }

  const tabItems = [
    { value: 'overview', label: 'Overview' },
    { value: 'contacts', label: 'Contacts' },
    { value: 'addresses', label: 'Addresses' },
    { value: 'defaults', label: 'Defaults' },
    ...(workspace.can('suppliers.history.view')
      ? [{ value: 'activity', label: 'Activity' }]
      : []),
  ]
  const activeTabLabel =
    tabItems.find((item) => item.value === tab)?.label || 'Overview'

  return (
    <>
      <StickyPageChrome
        before={
          <TextLink to="/app/suppliers" className="back-link">
            <ArrowLeft size={16} />
            Back to suppliers
          </TextLink>
        }
        eyebrow="SUPPLIER RELATIONSHIPS"
        title={supplier.name}
        description={[supplier.supplierCode, ...(supplier.capabilities || [])]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <div className="actions">
            {canEdit && (
              <Action variant="secondary" onClick={() => setEditing(true)}>
                Edit details
              </Action>
            )}
            {workspace.can('suppliers.edit') && workspace.writesAllowed && (
              <Action
                variant="secondary"
                disabled={mutation.pending || mutation.uncertain}
                onClick={lifecycle}
              >
                {supplier.status === 'active'
                  ? 'Archive supplier'
                  : 'Restore supplier'}
              </Action>
            )}
          </div>
        }
        meta={
          <>
            <ErrorNotice error={mutation.error} retry={resource.reload} />
            <MutationRetry
              mutation={mutation}
              saved={() => {
                resource.reload()
              }}
            />
          </>
        }
        tabs={{
          label: 'Supplier information',
          value: tab,
          onChange: setTab,
          items: tabItems,
        }}
      >
        <section className="panel" role="tabpanel" aria-label={activeTabLabel}>
          {tab === 'overview' ? (
            <SupplierOverview supplier={supplier} />
          ) : tab === 'contacts' || tab === 'addresses' ? (
            <SupplierChildrenPanel
              key={tab}
              kind={tab}
              base={base}
              canEdit={canEdit}
              parentArchived={supplier.status !== 'active'}
              changed={resource.reload}
            />
          ) : tab === 'defaults' ? (
            <SupplierDefaultsPanel
              base={base}
              canEdit={canEdit}
              changed={resource.reload}
            />
          ) : (
            <SupplierActivity path={base} />
          )}
        </section>
      </StickyPageChrome>
      {editing && (
        <SupplierEditor
          path={base}
          supplier={supplier}
          close={() => setEditing(false)}
          saved={(updated) => {
            setEditing(false)
            if (updated) saveSupplier(updated)
            resource.reload()
          }}
        />
      )}
    </>
  )
}
