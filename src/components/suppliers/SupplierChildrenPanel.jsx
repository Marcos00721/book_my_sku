import { useState } from 'react'
import { useMutation } from '../../hooks/useMutation'
import { useResource } from '../../hooks/useResource'
import { queryPath } from '../../services/workspace'
import { MutationRetry, Pager } from '../workspace/RecordTools'
import { SectionHeading } from '../workspace/SectionHeading'
import {
  Action,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  Status,
} from '../workspace/Elements'
import { purposeLabel } from './supplierPurposes'
import { SupplierChildEditor } from './SupplierChildEditor'

export function SupplierChildrenPanel({
  kind,
  base,
  canEdit,
  parentArchived,
  changed,
}) {
  const [open, setOpen] = useState(null)
  const [pages, setPages] = useState([])
  const [status, setStatus] = useState('active')
  const resource = useResource(
    queryPath(`${base}/${kind}`, { status, limit: 25, after: pages.at(-1) }),
  )
  const mutation = useMutation()

  async function lifecycle(child) {
    const action = child.status === 'active' ? 'archive' : 'restore'
    if (
      !window.confirm(
        `${action === 'archive' ? 'Archive' : 'Restore'} this record? Archiving clears affected defaults. Restore does not reinstate them.`,
      )
    )
      return
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
      <SectionHeading
        title={kind === 'contacts' ? 'People' : 'Saved addresses'}
        description={
          kind === 'contacts'
            ? 'The people you work with at this supplier.'
            : 'Ordering, ship-from, returns, and receiving places.'
        }
        actions={
          canEdit && (
            <Action onClick={() => setOpen({})}>
              Add {kind === 'contacts' ? 'contact' : 'address'}
            </Action>
          )
        }
      />
      <Field
        label={`${kind === 'contacts' ? 'Contact' : 'Address'} status`}
        value={status}
        onChange={(event) => {
          setStatus(event.target.value)
          setPages([])
        }}
      >
        {['active', 'archived', 'all'].map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </Field>
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
        <Loading />
      ) : resource.data?.items?.length ? (
        resource.data.items.map((child) => (
          <article className="address-card" key={child._id}>
            <h3>{child.name || child.label || 'Saved address'}</h3>
            <Status value={child.status} />
            {kind === 'contacts' ? (
              <>
                <p>
                  {child.email || 'Email required before editing or restoring'}
                </p>
                <p>
                  {child.phone} {child.jobTitle}
                </p>
              </>
            ) : (
              <>
                <p>
                  {Object.values(child.address || {})
                    .filter(Boolean)
                    .join(', ')}
                </p>
                {child.readiness && (
                  <p className="muted">
                    {child.readiness.complete
                      ? 'Complete; delivery unverified'
                      : `Draft: ${(child.readiness.missingFields || []).join(', ')}`}
                  </p>
                )}
              </>
            )}
            <p>
              {child.purposes?.map((value) => purposeLabel(value)).join(', ')}
            </p>
            {canEdit && (
              <div className="actions">
                {child.status === 'active' && (
                  <Action variant="secondary" onClick={() => setOpen(child)}>
                    Edit
                  </Action>
                )}
                <Action
                  variant="secondary"
                  disabled={mutation.pending || mutation.uncertain}
                  onClick={() => lifecycle(child)}
                >
                  {child.status === 'active' ? 'Archive' : 'Restore'}
                </Action>
              </div>
            )}
          </article>
        ))
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
      {open && (
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
