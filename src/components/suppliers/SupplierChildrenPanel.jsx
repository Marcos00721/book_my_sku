import { useState } from 'react'
import { Mail, MapPin, Phone, UserRound } from 'lucide-react'
import { useMutation } from '../../hooks/useMutation'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useResource } from '../../hooks/useResource'
import { queryPath } from '../../services/workspace'
import { MutationRetry, Pager } from '../workspace/RecordTools'
import { SectionHeading } from '../workspace/SectionHeading'
import {
  Action,
  Empty,
  ErrorNotice,
  ListSkeleton,
  Status,
} from '../workspace/Elements'
import { formatNumber } from '../../utils/phone'
import { askConfirm } from '../common/confirm'
import { SelectField } from '../common/SelectField'
import { purposeLabel } from './supplierPurposes'
import { SupplierChildEditor } from './SupplierChildEditor'

function SupplierContactCard({ contact, actions }) {
  return (
    <article className="supplier-contact-card">
      <header className="supplier-contact-heading">
        <span className="supplier-contact-icon" aria-hidden="true">
          <UserRound size={18} />
        </span>
        <div className="supplier-contact-identity">
          <h3>{contact.name || 'Saved contact'}</h3>
          {contact.jobTitle && <p>{contact.jobTitle}</p>}
        </div>
        <Status value={contact.status} />
      </header>
      <div className="supplier-contact-details">
        <p>
          <Mail size={15} aria-hidden="true" />
          <span>{contact.email || 'Email required before editing or restoring'}</span>
        </p>
        {contact.phone && (
          <p>
            <Phone size={15} aria-hidden="true" />
            <span>{formatNumber(contact.phone)}</span>
          </p>
        )}
      </div>
      {(contact.purposes?.length > 0 || actions) && (
        <footer className="supplier-contact-footer">
          {contact.purposes?.length > 0 && (
            <ul className="supplier-contact-purposes" aria-label="Contact responsibilities">
              {contact.purposes.map((value) => (
                <li key={value}>{purposeLabel(value)}</li>
              ))}
            </ul>
          )}
          {actions}
        </footer>
      )}
    </article>
  )
}

function SupplierAddressCard({ address: record, actions }) {
  const address = record.address || {}
  const street = [address.line1, address.line2].filter(Boolean).join(', ')
  const locality = [
    address.city,
    address.region || address.stateCode,
    address.postalCode,
    address.country,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <article className="supplier-address-card">
      <header className="supplier-address-heading">
        <span className="supplier-address-icon" aria-hidden="true">
          <MapPin size={18} />
        </span>
        <h3>{record.label || record.name || 'Saved address'}</h3>
        <Status value={record.status} />
      </header>
      <div className="supplier-address-details">
        <p className="supplier-address-location">
          {street && <span>{street}</span>}
          {locality && <span>{locality}</span>}
          {!street && !locality && <span>No address details added yet.</span>}
        </p>
        {record.readiness && (
          <p className="supplier-address-readiness">
            {record.readiness.complete
              ? 'Complete · Delivery unverified'
              : `Draft: ${(record.readiness.missingFields || []).join(', ')}`}
          </p>
        )}
      </div>
      <footer className="supplier-address-footer">
        {record.purposes?.length > 0 && (
          <ul className="supplier-address-purposes" aria-label="Address purposes">
            {record.purposes.map((value) => (
              <li key={value}>{purposeLabel(value)}</li>
            ))}
          </ul>
        )}
        {actions}
      </footer>
    </article>
  )
}

export function SupplierChildrenPanel({
  kind,
  base,
  canEdit,
  parentArchived,
  changed,
}) {
  const workspace = useWorkspace()
  const canCreate = !parentArchived && workspace.canWrite('suppliers.add')
  const canDelete = !parentArchived && workspace.canWrite('suppliers.delete')
  const [open, setOpen] = useState(null)
  const [pages, setPages] = useState([])
  const [status, setStatus] = useState('active')
  const resource = useResource(
    queryPath(`${base}/${kind}`, { status, limit: 25, after: pages.at(-1) }),
  )
  const mutation = useMutation()

  async function lifecycle(child) {
    const action = child.status === 'active' ? 'archive' : 'restore'
    const ok = await askConfirm({
      title: action === 'archive' ? 'Archive record?' : 'Restore record?',
      message: `${action === 'archive' ? 'Archive' : 'Restore'} this record? Archiving clears affected defaults. Restore does not reinstate them.`,
      confirmLabel: action === 'archive' ? 'Archive' : 'Restore',
      cancelLabel: 'Cancel',
      tone: action === 'archive' ? 'danger' : 'primary',
    })
    if (!ok) return
    if (kind === 'contacts' && action === 'restore' && !child.email) {
      setOpen(child)
      return
    }
    if (
      await mutation.run('post', `${base}/${kind}/${child._id}/${action}`, {
        expectedRevision: child.revision,
      })
    ) {
      resource.reload()
      changed()
    }
  }

  return (
    <>
      <div className="supplier-children-toolbar">
        <SectionHeading
          title={kind === 'contacts' ? 'People' : 'Saved addresses'}
          description={
            kind === 'contacts'
              ? 'The people you work with at this supplier.'
              : 'Ordering, ship-from, returns, and receiving places.'
          }
          actions={
            <div className="supplier-children-actions">
              <SelectField
                aria-label={kind === 'contacts' ? 'Contact status' : 'Address status'}
                title={kind === 'contacts' ? 'Contact status' : 'Address status'}
                className="supplier-children-status-filter"
                value={status}
                searchable={false}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'archived', label: 'Archived' },
                  { value: 'all', label: 'All' },
                ]}
                onChange={(event) => {
                  setStatus(event.target.value)
                  setPages([])
                }}
              />
              {canCreate ? (
                <Action onClick={() => setOpen({})}>Create</Action>
              ) : null}
            </div>
          }
        />
      </div>
      {parentArchived && (
        <p className="notice">
          Restore this supplier before changing its records.
        </p>
      )}
      <ErrorNotice
        error={resource.error || mutation.error}
        retry={resource.reload}
      />
      <MutationRetry
        mutation={mutation}
        saved={() => {
          resource.reload()
          changed()
        }}
      />
      {resource.loading ? (
        <ListSkeleton label={`Loading ${kind}…`} variant="list" rows={4} />
      ) : resource.data?.items?.length ? (
        <div className={kind === 'addresses' ? 'supplier-address-grid' : 'supplier-contact-cards'}>
          {resource.data.items.map((child) => {
            const actions = (canEdit || canDelete) && (
              <div className="actions">
                {canEdit && child.status === 'active' && (
                  <Action variant="secondary" onClick={() => setOpen(child)}>
                    Edit
                  </Action>
                )}
                {(child.status === 'active' ? canDelete : canEdit) && <Action
                  variant="secondary"
                  disabled={mutation.pending || mutation.uncertain}
                  onClick={() => lifecycle(child)}
                >
                  {child.status === 'active' ? 'Archive' : 'Restore'}
                </Action>}
              </div>
            )

            if (kind === 'addresses') {
              return (
                <SupplierAddressCard
                  key={child._id}
                  address={child}
                  actions={actions}
                />
              )
            }

            return (
              <SupplierContactCard
                key={child._id}
                contact={child}
                actions={actions}
              />
            )
          })}
        </div>
      ) : (
        !resource.error && (
          <Empty title={`No ${kind} found`}>
            Add a record or change the status filter.
          </Empty>
        )
      )}
      <Pager
        resource={resource}
        pages={pages}
        setPages={setPages}
        label={kind}
      />
      {open && (open._id ? canEdit : canCreate) && (
        <SupplierChildEditor
          kind={kind}
          base={base}
          record={open}
          close={() => setOpen(null)}
          saved={() => {
            setOpen(null)
            resource.reload()
            changed()
          }}
        />
      )}
    </>
  )
}
