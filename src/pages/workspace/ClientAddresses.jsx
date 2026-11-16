import { useState } from 'react'
import { Copy, MapPin, Pencil, Plus, RefreshCw, X } from 'lucide-react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useResource } from '../../hooks/useResource'
import { useMutation } from '../../hooks/useMutation'
import { queryPath } from '../../services/workspace'
import { AddressEditor } from '../../components/clients/AddressEditor'
import { SelectField } from '../../components/common/SelectField'
import { CursorPager } from '../../components/workspace/CursorPager'
import { Action, Dialog, Empty, ErrorNotice, ListSkeleton, SaveFooter, Status } from '../../components/workspace/Elements'

const FIELD_LABELS = {
  label: 'label', companyName: 'company name', line1: 'street address',
  city: 'city', region: 'state', stateCode: 'state', postalCode: 'postal code', country: 'country',
}
const usageLabel = usage => usage === 'both' ? 'Billing & shipping' : usage === 'shipping' ? 'Shipping' : 'Billing'

function AddressCard({ address, client, countries, editable, edit, copy, setDefault }) {
  const postal = address.address || {}
  const billing = client.defaultBillingAddressId === address.id
  const shipping = client.defaultShippingAddressId === address.id
  const isDefault = address.usage === 'both' ? billing && shipping : address.usage === 'shipping' ? shipping : billing
  const country = postal.countryName || countries.find(item => item.code === postal.country)?.name || postal.country
  const location = [postal.city, postal.region || postal.stateName || postal.stateCode?.split('-').at(-1), postal.postalCode].filter(Boolean).join(', ')
  const missing = (address.readiness?.missingFields || []).map(field => {
    const key = field.replace(/^address\./, '')
    return FIELD_LABELS[key] || key.replace(/([A-Z])/g, ' $1').replaceAll('_', ' ').toLowerCase()
  })
  const incomplete = address.readiness?.complete === false

  return <article className="client-address-card" aria-label={address.label || 'Address'}>
    <header className="client-address-card-heading">
      <MapPin size={18} aria-hidden="true" />
      <div><h3>{address.label || 'Untitled address'}</h3><small className="muted">{usageLabel(address.usage)}</small></div>
      <Status value={address.active ? 'active' : 'inactive'} />
    </header>
    <address className="client-address-postal">
      {address.companyName && <strong>{address.companyName}</strong>}
      {postal.line1 && <span>{postal.line1}</span>}
      {postal.line2 && <span>{postal.line2}</span>}
      {location && <span>{location}</span>}
      {country && <span>{country}</span>}
      {!postal.line1 && !location && !country && <span className="muted">No postal details yet</span>}
    </address>
    {incomplete && <p className="client-address-readiness">{missing.length ? `Missing: ${missing.join(', ')}` : 'Incomplete address'}</p>}
    {(billing || shipping) && <div className="client-address-badges">
      {billing && <Status value="billing default" />}
      {shipping && <Status value="shipping default" />}
    </div>}
    {editable && <footer className="client-address-card-actions">
      <Action variant="icon-button" aria-label={`Edit ${address.label || 'address'}`} title="Edit address" onClick={edit}><Pencil size={16} aria-hidden="true" /></Action>
      {address.active && <>
        <Action variant="icon-button" aria-label={`Copy ${address.label || 'address'}`} title="Copy address" onClick={copy}><Copy size={16} aria-hidden="true" /></Action>
        {!isDefault && <Action variant="secondary" disabled={incomplete} title={incomplete ? 'Complete this address before setting it as a default.' : undefined} onClick={setDefault}>
          {address.usage === 'both' ? 'Use for both' : `Use for ${address.usage}`}
        </Action>}
      </>}
    </footer>}
  </article>
}

export function ClientAddresses({ path, client, reloadClient }) {
  const workspace = useWorkspace()
  const [state, setState] = useState('active')
  const [history, setHistory] = useState([])
  const [editing, setEditing] = useState(null)
  const [command, setCommand] = useState(null)
  const resource = useResource(queryPath(`${path}/addresses`, { state, after: history.at(-1), limit: 25 }))
  const countries = useResource('/reference/countries')
  const items = resource.data?.items || []
  const editable = workspace.can('clients.edit') && workspace.writesAllowed && client.status !== 'archived'
  const hasDefaults = client.defaultBillingAddressId || client.defaultShippingAddressId

  function saved() {
    setEditing(null)
    setCommand(null)
    resource.reload()
    reloadClient()
  }

  function defaults(address) {
    const purpose = address.usage
    setCommand({
      title: `Set ${purpose === 'both' ? 'billing and shipping' : purpose} default`,
      description: purpose === 'both'
        ? `Use ${address.label || 'this address'} for billing and shipping? Changes to this address will apply to both.`
        : `Use ${address.label || 'this address'} as the ${purpose} default?`,
      method: 'put', path: `${path}/address-defaults`,
      payload: {
        expectedVersion: client.__v,
        ...(purpose !== 'shipping' ? { billing: { addressId: address.id, expectedRevision: address.revision } } : {}),
        ...(purpose !== 'billing' ? { shipping: { addressId: address.id, expectedRevision: address.revision } } : {}),
      },
    })
  }

  function clearDefault(purpose) {
    setCommand({
      title: `Clear ${purpose} default`,
      description: 'The saved address will remain available.',
      method: 'put', path: `${path}/address-defaults`,
      payload: { expectedVersion: client.__v, [purpose]: null },
    })
  }

  return <div className="client-addresses">
    <div className="client-addresses-heading">
      <h2>Addresses</h2>
      {editable && <Action onClick={() => setEditing({})}><Plus size={16} aria-hidden="true" />Add address</Action>}
    </div>
    <div className="client-addresses-toolbar">
      <SelectField label="Status" value={state} searchable={false} onChange={event => {
        setState(event.target.value)
        setHistory([])
      }}>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        <option value="all">All addresses</option>
      </SelectField>
      {editable && hasDefaults && <div className="client-address-defaults">
        <span className="muted">Defaults</span>
        {['billing', 'shipping'].map(purpose => client[purpose === 'billing' ? 'defaultBillingAddressId' : 'defaultShippingAddressId'] && <Action key={purpose} variant="text-button" aria-label={`Clear ${purpose} default`} title={`Clear ${purpose} default`} onClick={() => clearDefault(purpose)}>
          {purpose === 'billing' ? 'Billing' : 'Shipping'}<X size={14} aria-hidden="true" />
        </Action>)}
      </div>}
      <Action variant="secondary" className="client-address-refresh" aria-label="Refresh addresses" title="Refresh addresses" disabled={resource.loading} onClick={() => {
        resource.reload()
        reloadClient()
      }}><RefreshCw size={17} aria-hidden="true" /></Action>
    </div>
    <ErrorNotice error={resource.error} retry={resource.reload} />
    {resource.loading ? <ListSkeleton label="Loading addresses…" variant="cards" rows={4} /> : items.length ? <div className="client-address-grid">
      {items.map(address => <AddressCard key={address.id} address={address} client={client} countries={countries.data?.countries || []} editable={editable}
        edit={() => setEditing(address)}
        copy={() => setCommand({
          title: 'Copy address', description: 'Create a separate address. Future edits will not affect the original.',
          method: 'post', path: `${path}/addresses/${address.id}/copy`,
          payload: { expectedSourceRevision: address.revision }, label: 'Copy',
        })}
        setDefault={() => defaults(address)}
      />)}
    </div> : !resource.error && <Empty title={history.length ? 'No addresses on this page' : state === 'active' ? 'No addresses yet' : 'No matching addresses'}>
      {state === 'active' ? 'Add a billing or shipping address.' : 'Try a different status.'}
    </Empty>}
    {resource.data && (items.length > 0 || history.length > 0) && <CursorPager count={items.length} label={items.length === 1 ? 'address' : 'addresses'} pages={history} setPages={setHistory} next={resource.data.next} />}
    {editing && <AddressEditor path={path} address={editing} close={() => setEditing(null)} saved={saved} />}
    {command && <AddressCommand command={command} close={() => setCommand(null)} saved={saved} />}
  </div>
}

function AddressCommand({ command, close, saved }) {
  const mutation = useMutation()
  return <Dialog title={command.title} close={close} locked={mutation.pending || mutation.uncertain}>
    <p className="muted">{command.description}</p>
    <form onSubmit={async event => {
      event.preventDefault()
      if (await mutation.run(command.method, command.path, command.payload)) saved()
    }}>
      <SaveFooter mutation={mutation} close={close} label={command.label || 'Confirm'} />
    </form>
  </Dialog>
}
