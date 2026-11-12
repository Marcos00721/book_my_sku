import { useState } from 'react'
import { useMutation } from '../../hooks/useMutation'
import { useResource } from '../../hooks/useResource'
import { queryPath } from '../../services/workspace'
import { MutationRetry, Pager } from '../workspace/RecordTools'
import { SectionHeading } from '../workspace/SectionHeading'
import {
  Action,
  ErrorNotice,
  Field,
  Loading,
} from '../workspace/Elements'
import { purposeLabel } from './supplierPurposes'

export function SupplierDefaultsPanel({ base, canEdit, changed }) {
  const resource = useResource(`${base}/defaults`)
  const [kind, setKind] = useState('contacts')
  const [pages, setPages] = useState([])
  const choices = useResource(
    queryPath(`${base}/${kind}`, {
      status: 'active',
      limit: 25,
      after: pages.at(-1),
    }),
  )
  const mutation = useMutation()

  async function select(purpose, record) {
    const body = {
      expectedRevision: resource.data.defaults.revision,
      [purpose]: record
        ? { id: record._id, expectedRevision: record.revision }
        : null,
    }
    if (await mutation.run('put', `${base}/defaults`, body)) {
      resource.reload()
      changed()
    }
  }

  if (resource.loading) return <Loading />

  return (
    <>
      <SectionHeading
        title="Supplier defaults"
        description="Pick the contact and addresses used most often for this supplier."
      />
      <MutationRetry
        mutation={mutation}
        saved={() => {
          resource.reload()
          changed()
        }}
      />
      <ErrorNotice
        error={resource.error || mutation.error || choices.error}
        retry={() => {
          resource.reload()
          choices.reload()
        }}
      />
      {resource.data && (
        <>
          <dl className="detail-list">
            {[
              ['primaryContact', 'primaryContactId'],
              ['ordering', 'orderingAddressId'],
              ['ship_from', 'shipFromAddressId'],
              ['returns', 'returnsAddressId'],
              ['receiving', 'receivingAddressId'],
            ].map(([purpose, key]) => (
              <div key={key}>
                <dt>{purposeLabel(purpose)}</dt>
                <dd>
                  {resource.data.defaults[key] || 'Not set'}{' '}
                  {canEdit && (
                    <Action
                      variant="text-button"
                      disabled={mutation.pending || mutation.uncertain}
                      onClick={() => select(purpose, null)}
                    >
                      Clear
                    </Action>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          {canEdit && (
            <>
              <Field
                label="Choose default from"
                value={kind}
                onChange={(event) => {
                  setKind(event.target.value)
                  setPages([])
                }}
              >
                <option value="contacts">Contacts</option>
                <option value="addresses">Addresses</option>
              </Field>
              {choices.loading ? (
                <Loading />
              ) : (
                choices.data?.items?.map((record) => (
                  <div className="grant-row" key={record._id}>
                    <span>
                      {record.name ||
                        record.label ||
                        record.address?.line1 ||
                        'Address'}
                    </span>
                    <div className="actions">
                      {(kind === 'contacts'
                        ? ['primaryContact']
                        : record.purposes
                      ).map((purpose) => (
                        <Action
                          key={purpose}
                          variant="secondary"
                          disabled={mutation.pending || mutation.uncertain}
                          onClick={() => select(purpose, record)}
                        >
                          Use for {purposeLabel(purpose)}
                        </Action>
                      ))}
                    </div>
                  </div>
                ))
              )}
              <Pager
                resource={choices}
                pages={pages}
                setPages={setPages}
                label="choices"
              />
            </>
          )}
        </>
      )}
    </>
  )
}
