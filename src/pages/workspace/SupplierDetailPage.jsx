import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Archive, Pencil, Plus, RotateCcw } from 'lucide-react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useMutation } from '../../hooks/useMutation'
import { useResource } from '../../hooks/useResource'
import { queryPath } from '../../services/workspace'
import { Action, Dialog, Empty, ErrorNotice, Field, Loading, PageHeader, PermissionDenied, SaveFooter, Status } from '../../components/workspace/Elements'
import { SupplierEditor } from './SuppliersPage'

export function SupplierDetailPage() {
  const workspace = useWorkspace()
  const { supplierId } = useParams()
  if (!workspace.can('suppliers.view')) return <PermissionDenied />
  return <SupplierRecord key={`${workspace.organization.id}:${supplierId}`} base={`${workspace.base}/suppliers/${encodeURIComponent(supplierId)}`} />
}

function SupplierRecord({ base }) {
  const workspace = useWorkspace()
  const resource = useResource(base)
  const [tab, setTab] = useState('contacts')
  const [editing, setEditing] = useState(false)
  const mutation = useMutation()
  if (resource.loading) return <Loading label="Loading supplier…" />
  if (resource.error) return <ErrorNotice error={resource.error} retry={resource.reload} />
  const supplier = resource.data
  const canEdit = workspace.can('suppliers.edit') && workspace.writesAllowed && supplier.status === 'active'
  async function changeStatus(action) {
    if (await mutation.run('post', `${base}/${action}`, { expectedRevision: supplier.revision })) resource.reload()
  }
  return <>
    <Link to="/app/suppliers" className="back-link"><ArrowLeft size={16} /> Back to suppliers</Link>
    <PageHeader title={supplier.name} description="Supplier and decorator contacts, addresses, and defaults." actions={workspace.can('suppliers.edit') && workspace.writesAllowed && <div className="actions">
      {supplier.status === 'active' && <><Action variant="secondary" onClick={() => setEditing(true)}><Pencil size={15} /> Edit</Action><Action variant="danger-button" disabled={mutation.pending} onClick={() => changeStatus('archive')}><Archive size={15} /> Archive</Action></>}
      {supplier.status === 'archived' && <Action variant="secondary" disabled={mutation.pending} onClick={() => changeStatus('restore')}><RotateCcw size={15} /> Restore</Action>}
    </div>} />
    <div className="detail-summary panel"><Status value={supplier.status} /><span>{supplier.capabilities.join(' · ')}</span><span>Updated {new Date(supplier.updatedAt).toLocaleDateString()}</span></div>
    <ErrorNotice error={mutation.error} retry={resource.reload} />
    <div className="tabs" role="tablist" aria-label="Supplier details">{[['contacts', 'Contacts'], ['addresses', 'Addresses'], ['defaults', 'Defaults']].map(([value, label]) => <button key={value} role="tab" aria-selected={tab === value} onClick={() => setTab(value)}>{label}</button>)}</div>
    {tab === 'contacts' && <SupplierContacts base={base} canEdit={canEdit} parentArchived={supplier.status !== 'active'} />}
    {tab === 'addresses' && <SupplierAddresses base={base} canEdit={canEdit} parentArchived={supplier.status !== 'active'} />}
    {tab === 'defaults' && <SupplierDefaults base={base} canEdit={canEdit} parentArchived={supplier.status !== 'active'} />}
    {editing && <SupplierEditor path={base} supplier={supplier} close={() => setEditing(false)} saved={() => { setEditing(false); resource.reload() }} />}
  </>
}

function SupplierContacts({ base, canEdit, parentArchived }) {
  const [open, setOpen] = useState(null)
  const [page, setPage] = useState([])
  const [status, setStatus] = useState('active')
  const path = queryPath(`${base}/contacts`, { status, limit: 25, after: page.at(-1) })
  const resource = useResource(path)
  const mutation = useMutation()
  async function lifecycle(contact, action) {
    if (await mutation.run('post', `${base}/contacts/${contact._id}/${action}`, { expectedRevision: contact.revision })) resource.reload()
  }
  return <section className="panel">
    <div className="section-heading"><div><h2>People</h2><p className="muted">Contacts who help with ordering and coordination.</p></div><div className="actions">{canEdit && <Action onClick={() => setOpen({})}><Plus size={15} /> Add contact</Action>}<Field label="Status" value={status} onChange={(event) => { setStatus(event.target.value); setPage([]) }}><option value="active">Active</option><option value="archived">Archived</option><option value="all">All</option></Field></div></div>
    {parentArchived && <p className="notice">Restore this supplier before changing contacts or defaults.</p>}
    <ErrorNotice error={resource.error || mutation.error} retry={resource.reload} />
    {resource.loading ? <Loading /> : resource.data?.items?.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Actions</th></tr></thead><tbody>{resource.data.items.map((contact) => <tr key={contact._id}><td><strong>{contact.name}</strong><small>{contact.jobTitle || '—'}</small></td><td>{contact.email || '—'}</td><td>{contact.phone || '—'}</td><td><Status value={contact.status} /></td><td><div className="actions">{canEdit && contact.status === 'active' && <><Action variant="secondary" onClick={() => setOpen(contact)}>Edit</Action><Action variant="secondary" onClick={() => lifecycle(contact, 'archive')}>Archive</Action></>}{canEdit && contact.status === 'archived' && <Action variant="secondary" onClick={() => lifecycle(contact, 'restore')}>Restore</Action>}</div></td></tr>)}</tbody></table></div> : !resource.error && <Empty title="No contacts yet">Add the people you work with at this supplier.</Empty>}
    {resource.data && <div className="table-bottom"><span>{resource.data.items.length} contacts</span><div className="actions"><Action variant="secondary" disabled={!page.length} onClick={() => setPage((items) => items.slice(0, -1))}>Previous</Action><Action variant="secondary" disabled={!resource.data.next} onClick={() => setPage((items) => [...items, resource.data.next])}>Next</Action></div></div>}
    {open && <ContactForm base={base} contact={open} close={() => setOpen(null)} saved={() => { setOpen(null); resource.reload() }} />}
  </section>
}

function ContactForm({ base, contact, close, saved }) {
  const [fields, setFields] = useState({ name: contact.name || '', email: contact.email || '', phone: contact.phone || '', jobTitle: contact.jobTitle || '' })
  const mutation = useMutation()
  async function submit(event) {
    event.preventDefault()
    const body = { ...fields, name: fields.name.trim(), email: fields.email.trim() || null, phone: fields.phone.trim() || null, jobTitle: fields.jobTitle.trim() || null, ...(contact._id ? { expectedRevision: contact.revision } : {}) }
    if (await mutation.run(contact._id ? 'patch' : 'post', contact._id ? `${base}/contacts/${contact._id}` : `${base}/contacts`, body)) saved()
  }
  return <Dialog title={contact._id ? 'Edit contact' : 'Add a contact'} close={close} locked={mutation.pending || mutation.uncertain}><form onSubmit={submit}><fieldset disabled={mutation.pending || mutation.uncertain}>{[['name','Name',160],['email','Email',254],['phone','Phone',40],['jobTitle','Job title',120]].map(([key,label,maxLength]) => <Field key={key} label={label} type={key === 'email' ? 'email' : 'text'} required={key === 'name'} maxLength={maxLength} value={fields[key]} onChange={(event) => setFields({ ...fields, [key]: event.target.value })} />)}</fieldset><SaveFooter mutation={mutation} close={close} label={contact._id ? 'Save contact' : 'Create contact'} /></form></Dialog>
}

function SupplierAddresses({ base, canEdit, parentArchived }) {
  const [open, setOpen] = useState(null)
  const [page, setPage] = useState([])
  const [status, setStatus] = useState('active')
  const path = queryPath(`${base}/addresses`, { status, limit: 25, after: page.at(-1) })
  const resource = useResource(path)
  const mutation = useMutation()
  async function lifecycle(address, action) {
    if (await mutation.run('post', `${base}/addresses/${address._id}/${action}`, { expectedRevision: address.revision })) resource.reload()
  }
  return <section className="panel">
    <div className="section-heading"><div><h2>Business addresses</h2><p className="muted">Save ordering, ship-from, or returns locations.</p></div><div className="actions">{canEdit && <Action onClick={() => setOpen({})}><Plus size={15} /> Add address</Action>}<Field label="Status" value={status} onChange={(event) => { setStatus(event.target.value); setPage([]) }}><option value="active">Active</option><option value="archived">Archived</option><option value="all">All</option></Field></div></div>
    {parentArchived && <p className="notice">Restore this supplier before changing addresses or defaults.</p>}
    <ErrorNotice error={resource.error || mutation.error} retry={resource.reload} />
    {resource.loading ? <Loading /> : resource.data?.items?.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Label and address</th><th>Purposes</th><th>Status</th><th>Actions</th></tr></thead><tbody>{resource.data.items.map((address) => <tr key={address._id}><td><strong>{address.label || 'Address'}</strong><small>{[address.address.line1, address.address.city, address.address.region, address.address.postalCode, address.address.country].filter(Boolean).join(', ') || 'Incomplete address'}</small></td><td>{address.purposes.join(', ')}</td><td><Status value={address.status} /></td><td><div className="actions">{canEdit && address.status === 'active' && <><Action variant="secondary" onClick={() => setOpen(address)}>Edit</Action><Action variant="secondary" onClick={() => lifecycle(address, 'archive')}>Archive</Action></>}{canEdit && address.status === 'archived' && <Action variant="secondary" onClick={() => lifecycle(address, 'restore')}>Restore</Action>}</div></td></tr>)}</tbody></table></div> : !resource.error && <Empty title="No addresses saved">Save a supplier location for ordering, shipping, or returns.</Empty>}
    {resource.data && <div className="table-bottom"><span>{resource.data.items.length} addresses</span><div className="actions"><Action variant="secondary" disabled={!page.length} onClick={() => setPage((items) => items.slice(0, -1))}>Previous</Action><Action variant="secondary" disabled={!resource.data.next} onClick={() => setPage((items) => [...items, resource.data.next])}>Next</Action></div></div>}
    {open && <AddressForm base={base} address={open} close={() => setOpen(null)} saved={() => { setOpen(null); resource.reload() }} />}
  </section>
}

function AddressForm({ base, address, close, saved }) {
  const [label, setLabel] = useState(address.label || '')
  const [purposes, setPurposes] = useState(address.purposes || ['ordering'])
  const [fields, setFields] = useState(Object.fromEntries(['line1','line2','city','region','postalCode','country'].map((key) => [key, address.address?.[key] || ''])))
  const mutation = useMutation()
  function toggle(value) { setPurposes((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]) }
  async function submit(event) {
    event.preventDefault()
    const body = { label: label.trim() || null, purposes, address: Object.fromEntries(Object.entries(fields).map(([key,value]) => [key, value.trim() || null])), ...(address._id ? { expectedRevision: address.revision } : {}) }
    if (await mutation.run(address._id ? 'patch' : 'post', address._id ? `${base}/addresses/${address._id}` : `${base}/addresses`, body)) saved()
  }
  return <Dialog title={address._id ? 'Edit address' : 'Add an address'} close={close} locked={mutation.pending || mutation.uncertain}><form onSubmit={submit}><fieldset disabled={mutation.pending || mutation.uncertain}><Field label="Label" maxLength={80} value={label} onChange={(event) => setLabel(event.target.value)} /><fieldset className="choice-group"><legend>Use this address for</legend>{[['ordering','Ordering'],['ship_from','Ship from'],['returns','Returns']].map(([value,text]) => <label className="check-label" key={value}><input type="checkbox" checked={purposes.includes(value)} onChange={() => toggle(value)} />{text}</label>)}</fieldset><div className="form-grid">{[['line1','Address line 1'],['line2','Address line 2'],['city','City'],['region','State / region'],['postalCode','Postal code'],['country','Country code']].map(([key,text]) => <Field key={key} label={text} maxLength={key === 'country' ? 2 : key === 'postalCode' ? 32 : ['city','region'].includes(key) ? 100 : 160} value={fields[key]} onChange={(event) => setFields({ ...fields, [key]: key === 'country' ? event.target.value.toUpperCase() : event.target.value })} />)}</div><p className="muted">Incomplete addresses can be saved as drafts; complete them before using for shipping.</p></fieldset><SaveFooter mutation={mutation} close={close} disabled={!purposes.length} label={address._id ? 'Save address' : 'Create address'} /></form></Dialog>
}

function SupplierDefaults({ base, canEdit, parentArchived }) {
  const resource = useResource(`${base}/defaults`)
  const contacts = useResource(queryPath(`${base}/contacts`, { status: 'active', limit: 50 }))
  const addresses = useResource(queryPath(`${base}/addresses`, { status: 'active', limit: 50 }))
  const mutation = useMutation()
  const [values, setValues] = useState(null)
  const defaults = resource.data?.defaults
  if (resource.loading || contacts.loading || addresses.loading) return <Loading label="Loading supplier defaults…" />
  if (resource.error || contacts.error || addresses.error) return <ErrorNotice error={resource.error || contacts.error || addresses.error} retry={() => { resource.reload(); contacts.reload(); addresses.reload() }} />
  const selected = values || { primaryContactId: defaults?.primaryContactId || '', orderingAddressId: defaults?.orderingAddressId || '', shipFromAddressId: defaults?.shipFromAddressId || '', returnsAddressId: defaults?.returnsAddressId || '' }
  async function save(event) {
    event.preventDefault()
    const body = { expectedRevision: defaults?.revision || 0 }
    const contact = contacts.data.items.find((item) => item._id === selected.primaryContactId)
    const addressFor = (id) => addresses.data.items.find((item) => item._id === id)
    body.primaryContact = selected.primaryContactId ? { id: contact._id, expectedRevision: contact.revision } : null
    for (const [key, field] of [['ordering','orderingAddressId'],['ship_from','shipFromAddressId'],['returns','returnsAddressId']]) {
      if (selected[field] !== (defaults?.[field] || '')) {
        const address = addressFor(selected[field])
        body[key] = address ? { id: address._id, expectedRevision: address.revision } : null
      }
    }
    const result = await mutation.run('put', `${base}/defaults`, body)
    if (result) { setValues(null); resource.reload() }
  }
  function set(key, value) { setValues({ ...selected, [key]: value }) }
  const addressChoices = (purpose) => addresses.data.items.filter((address) => address.purposes.includes(purpose))
  return <section className="panel"><h2>Supplier defaults</h2><p className="muted">Choose the contact and address used by default. These choices do not create payment or shipping terms.</p>{parentArchived && <p className="notice">Defaults are read-only while the supplier is archived.</p>}<ErrorNotice error={mutation.error} retry={resource.reload} />
    <form onSubmit={save}><fieldset disabled={!canEdit || mutation.pending || mutation.uncertain}><Field label="Primary contact" value={selected.primaryContactId} onChange={(event) => set('primaryContactId', event.target.value)}><option value="">No default</option>{contacts.data.items.map((contact) => <option key={contact._id} value={contact._id}>{contact.name}</option>)}</Field>{[['orderingAddressId','Ordering address','ordering'],['shipFromAddressId','Ship-from address','ship_from'],['returnsAddressId','Returns address','returns']].map(([field,label,purpose]) => <Field key={field} label={label} value={selected[field]} onChange={(event) => set(field,event.target.value)}><option value="">No default</option>{addressChoices(purpose).map((address) => <option key={address._id} value={address._id}>{address.label || address.address.line1 || 'Address'} · rev {address.revision}</option>)}</Field>)}</fieldset>{canEdit && <SaveFooter mutation={mutation} label="Save defaults" disabled={JSON.stringify(selected) === JSON.stringify({ primaryContactId: defaults?.primaryContactId || '', orderingAddressId: defaults?.orderingAddressId || '', shipFromAddressId: defaults?.shipFromAddressId || '', returnsAddressId: defaults?.returnsAddressId || '' })} />}</form>
  </section>
}
