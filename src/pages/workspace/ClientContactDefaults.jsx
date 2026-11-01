import { useState } from 'react'
import { useResource } from '../../hooks/useResource'
import { useMutation } from '../../hooks/useMutation'
import {
  Action,
  ErrorNotice,
  Loading,
} from '../../components/workspace/Elements'
import { MutationRetry, Pager } from '../../components/workspace/RecordTools'
import { queryPath } from '../../services/workspace'

export function ClientContactDefaults({ path, editable, saved }) {
  const defaults = useResource(`${path}/defaults`)
  const [pages, setPages] = useState([])
  const contacts = useResource(
    queryPath(path, { state: 'active', limit: 50, after: pages.at(-1) }),
  )
  const mutation = useMutation()
  async function select(purpose, contact) {
    if (
      await mutation.run('patch', `${path}/defaults`, {
        expectedClientVersion: defaults.data.clientVersion,
        [purpose]: contact
          ? { contactId: contact._id, expectedVersion: contact.__v }
          : null,
      })
    ) {
      defaults.reload()
      saved()
    }
  }
  if (defaults.loading) return <Loading label="Loading contact defaults…" />
  return (
    <details>
      <summary>Primary and billing contacts</summary>
      <MutationRetry
        mutation={mutation}
        saved={() => {
          defaults.reload()
          saved()
        }}
      />
      <p>
        Defaults apply to future selection and do not change existing documents.
      </p>
      <ErrorNotice
        error={defaults.error || mutation.error || contacts.error}
        retry={() => {
          defaults.reload()
          contacts.reload()
        }}
      />
      {defaults.data && (
        <>
          <p>
            Primary: {defaults.data.primaryContactId || 'Not set'} · Billing:{' '}
            {defaults.data.billingContactId || 'Not set'}
          </p>
          {editable && (
            <>
              <div className="actions">
                <Action
                  variant="secondary"
                  disabled={mutation.pending || mutation.uncertain}
                  onClick={() => select('primary', null)}
                >
                  Clear primary contact
                </Action>
                <Action
                  variant="secondary"
                  disabled={mutation.pending || mutation.uncertain}
                  onClick={() => select('billing', null)}
                >
                  Clear billing contact
                </Action>
              </div>
              {contacts.data?.items?.map((contact) => (
                <div className="grant-row" key={contact._id}>
                  <span>{contact.name}</span>
                  <div className="actions">
                    <Action
                      variant="secondary"
                      disabled={mutation.pending || mutation.uncertain}
                      onClick={() => select('primary', contact)}
                    >
                      Use as primary
                    </Action>
                    <Action
                      variant="secondary"
                      disabled={mutation.pending || mutation.uncertain}
                      onClick={() => select('billing', contact)}
                    >
                      Use for billing
                    </Action>
                  </div>
                </div>
              ))}
              <Pager
                resource={contacts}
                pages={pages}
                setPages={setPages}
                label="contacts"
              />
            </>
          )}
        </>
      )}
    </details>
  )
}
