import { useState } from 'react'
import { Copy, MapPin, Plus } from 'lucide-react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useResource } from '../../hooks/useResource'
import { useMutation } from '../../hooks/useMutation'
import { queryPath } from '../../services/workspace'
import {
  Action,
  Dialog,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  SaveFooter,
  Status,
} from '../../components/workspace/Elements'

export function ClientAddresses({ path, client, reloadClient }) {
  const workspace = useWorkspace()
  const [state, setState] = useState('active')
  const [history, setHistory] = useState([])
  const [editing, setEditing] = useState(null)
  const [command, setCommand] = useState(null)
  const resource = useResource(
    queryPath(`${path}/addresses`, { state, after: history.at(-1), limit: 25 }),
  )
  const editable = workspace.can('clients.edit') && workspace.writesAllowed
  function saved() {
    setEditing(null)
    setCommand(null)
    resource.reload()
    reloadClient()
  }
  function defaults(address, purpose) {
    setCommand({
      title: `Set ${purpose === 'both' ? 'billing and shipping' : purpose} default`,
      description:
        purpose === 'both'
          ? 'One shared address record will serve both billing and shipping. Changes to this record will apply to both.'
          : `Use this address as the client’s ${purpose} default.`,
      method: 'put',
      path: `${path}/address-defaults`,
      payload: {
        expectedVersion: client.__v,
        ...(purpose !== 'shipping'
          ? {
              billing: {
                addressId: address.id,
                expectedRevision: address.revision,
              },
            }
          : {}),
        ...(purpose !== 'billing'
          ? {
              shipping: {
                addressId: address.id,
                expectedRevision: address.revision,
              },
            }
          : {}),
      },
    })
  }
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Every place, saved</h2>
          <p className="muted">
            Reusable billing and shipping addresses for this client.
          </p>
        </div>
        {editable && (
          <Action onClick={() => setEditing({})}>
            <Plus size={16} />
            Add address
          </Action>
        )}
      </div>
      <div className="toolbar">
        <Field
          label="Show addresses"
          value={state}
          onChange={(event) => {
            setState(event.target.value)
            setHistory([])
          }}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="all">All addresses</option>
        </Field>
        <Action
          variant="secondary"
          onClick={() => {
            resource.reload()
            reloadClient()
          }}
        >
          Refresh
        </Action>
      </div>
      {editable &&
        (client.defaultBillingAddressId || client.defaultShippingAddressId) && (
          <div className="actions">
            {['billing', 'shipping'].map(
              (purpose) =>
                client[
                  purpose === 'billing'
                    ? 'defaultBillingAddressId'
                    : 'defaultShippingAddressId'
                ] && (
                  <Action
                    key={purpose}
                    variant="text-button"
                    onClick={() =>
                      setCommand({
                        title: `Clear ${purpose} default`,
                        description:
                          'The saved address will remain available in this address book.',
                        method: 'put',
                        path: `${path}/address-defaults`,
                        payload: {
                          expectedVersion: client.__v,
                          [purpose]: null,
                        },
                      })
                    }
                  >
                    Clear {purpose} default
                  </Action>
                ),
            )}
          </div>
        )}
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <Loading label="Loading saved addresses…" />
      ) : resource.data?.items?.length ? (
        <div className="address-grid">
          {resource.data.items.map((address) => (
            <article className="address-card" key={address.id}>
              <div className="section-heading">
                <MapPin size={20} className="muted" />
                <Status value={address.active ? 'active' : 'inactive'} />
              </div>
              <h3>{address.label || 'Untitled address'}</h3>
              <small className="muted">
                {address.usage === 'both'
                  ? 'Billing & shipping · shared record'
                  : address.usage}
              </small>
              <p>
                {[
                  address.companyName,
                  ...[
                    'line1',
                    'line2',
                    'city',
                    'region',
                    'postalCode',
                    'country',
                  ].map((key) => address.address?.[key]),
                ]
                  .filter(Boolean)
                  .join('\n') || 'Draft address — no postal details yet.'}
              </p>
              <div className="actions">
                {client.defaultBillingAddressId === address.id && (
                  <Status value="billing default" />
                )}
                {client.defaultShippingAddressId === address.id && (
                  <Status value="shipping default" />
                )}
              </div>
              {editable && (
                <div className="actions">
                  <Action
                    variant="secondary"
                    onClick={() => setEditing(address)}
                  >
                    Edit
                  </Action>
                  {address.active && (
                    <>
                      <Action
                        variant="secondary"
                        aria-label={`Copy ${address.label || 'address'}`}
                        onClick={() =>
                          setCommand({
                            title: 'Make an independent copy',
                            description:
                              'The new address has its own ID. Later edits to either address will not change the other. Defaults stay unchanged.',
                            method: 'post',
                            path: `${path}/addresses/${address.id}/copy`,
                            payload: {
                              expectedSourceRevision: address.revision,
                            },
                          })
                        }
                      >
                        <Copy size={13} />
                        Copy
                      </Action>
                      {address.usage === 'both' ? (
                        <Action
                          variant="secondary"
                          onClick={() => defaults(address, 'both')}
                        >
                          Use for both
                        </Action>
                      ) : (
                        <Action
                          variant="secondary"
                          onClick={() => defaults(address, address.usage)}
                        >
                          Use for {address.usage}
                        </Action>
                      )}
                    </>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        !resource.error && (
          <Empty title="A place for every address">
            Save a billing, shipping, or shared address when you’re ready.
          </Empty>
        )
      )}
      {resource.data && (
        <div className="table-bottom">
          <span>{resource.data.items.length} addresses on this page</span>
          <div className="actions">
            <Action
              variant="secondary"
              disabled={!history.length}
              onClick={() => setHistory((value) => value.slice(0, -1))}
            >
              Previous
            </Action>
            <Action
              variant="secondary"
              disabled={!resource.data.next}
              onClick={() =>
                setHistory((value) => [...value, resource.data.next])
              }
            >
              Next
            </Action>
          </div>
        </div>
      )}
      {editing && (
        <AddressEditor
          path={path}
          address={editing}
          close={() => setEditing(null)}
          saved={saved}
        />
      )}
      {command && (
        <AddressCommand
          command={command}
          close={() => setCommand(null)}
          saved={saved}
        />
      )}
    </>
  )
}

function AddressCommand({ command, close, saved }) {
  const mutation = useMutation()
  return (
    <Dialog
      title={command.title}
      close={close}
      locked={mutation.pending || mutation.uncertain}
    >
      <p className="muted">{command.description}</p>
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          if (await mutation.run(command.method, command.path, command.payload))
            saved()
        }}
      >
        <SaveFooter mutation={mutation} close={close} label="Confirm" />
      </form>
    </Dialog>
  )
}

function AddressEditor({ path, address, close, saved }) {
  const [values, setValues] = useState({
    label: address.label || '',
    companyName: address.companyName || '',
    usage: address.usage || 'billing',
    active: address.active ?? true,
    ...Object.fromEntries(
      ['line1', 'line2', 'city', 'region', 'postalCode', 'country'].map(
        (key) => [key, address.address?.[key] || ''],
      ),
    ),
  })
  const mutation = useMutation()
  const set = (key, value) =>
    setValues((current) => ({ ...current, [key]: value }))
  async function submit(event) {
    event.preventDefault()
    const payload = {
      label: values.label.trim() || null,
      companyName: values.companyName.trim() || null,
      usage: values.usage,
      address: Object.fromEntries(
        ['line1', 'line2', 'city', 'region', 'postalCode', 'country'].map(
          (key) => [key, values[key].trim() || null],
        ),
      ),
      ...(address.id
        ? { expectedRevision: address.revision, active: values.active }
        : {}),
    }
    if (
      await mutation.run(
        address.id ? 'patch' : 'post',
        `${path}/addresses${address.id ? `/${address.id}` : ''}`,
        payload,
      )
    )
      saved()
  }
  return (
    <Dialog
      title={address.id ? 'Edit saved address' : 'Save an address'}
      close={close}
      locked={mutation.pending || mutation.uncertain}
    >
      <form onSubmit={submit}>
        <fieldset disabled={mutation.pending || mutation.uncertain}>
          <div className="form-grid">
            <Field
              label="Label"
              value={values.label}
              maxLength={80}
              onChange={(event) => set('label', event.target.value)}
            />
            <Field
              label="Company name"
              value={values.companyName}
              maxLength={160}
              onChange={(event) => set('companyName', event.target.value)}
            />
          </div>
          <Field
            label="Use this address for"
            value={values.usage}
            onChange={(event) => set('usage', event.target.value)}
          >
            <option value="billing">Billing</option>
            <option value="shipping">Shipping</option>
            <option value="both">Billing & shipping (shared record)</option>
          </Field>
          <Field
            label="Address line 1"
            value={values.line1}
            maxLength={160}
            onChange={(event) => set('line1', event.target.value)}
          />
          <Field
            label="Address line 2"
            value={values.line2}
            maxLength={160}
            onChange={(event) => set('line2', event.target.value)}
          />
          <div className="form-grid">
            {[
              ['city', 'City', 100],
              ['region', 'State / region', 100],
              ['postalCode', 'Postal code', 32],
              ['country', 'Country code', 2],
            ].map(([key, label, maxLength]) => (
              <Field
                key={key}
                label={label}
                value={values[key]}
                maxLength={maxLength}
                pattern={key === 'country' ? '[A-Z]{2}' : undefined}
                placeholder={key === 'country' ? 'IN, US, GB…' : undefined}
                onChange={(event) =>
                  set(
                    key,
                    key === 'country'
                      ? event.target.value.toUpperCase()
                      : event.target.value,
                  )
                }
              />
            ))}
          </div>
          {address.id && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={values.active}
                onChange={(event) => set('active', event.target.checked)}
              />
              Active address. Deactivating or changing its use clears
              incompatible defaults.
            </label>
          )}
        </fieldset>
        <SaveFooter mutation={mutation} close={close} label="Save address" />
      </form>
    </Dialog>
  )
}
