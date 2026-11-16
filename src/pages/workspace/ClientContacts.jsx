import { useState } from 'react'
import { Archive, Pencil, Plus, RefreshCw, RotateCcw, Search, X } from 'lucide-react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useResource } from '../../hooks/useResource'
import { useMutation } from '../../hooks/useMutation'
import { queryPath } from '../../services/workspace'
import { ContactEditor } from '../../components/clients/ContactEditor'
import { SelectField } from '../../components/common/SelectField'
import { TextField } from '../../components/common/TextField'
import { askConfirm } from '../../components/common/confirm'
import { Action, Empty, ErrorNotice, ListSkeleton, PermissionDenied, Status } from '../../components/workspace/Elements'
import { CursorPager } from '../../components/workspace/CursorPager'
import { MutationRetry } from '../../components/workspace/RecordTools'
import { formatNumber, stripPhoneFormatting } from '../../utils/phone'
import { ClientContactDefaults } from './ClientContactDefaults'

export function ClientContacts(props) {
  const workspace = useWorkspace()
  if (!workspace.can('contacts.view')) return <PermissionDenied />
  return <ContactDirectory {...props} />
}

function ContactDirectory({ path, archived, reloadClient }) {
  const workspace = useWorkspace()
  const [editing, setEditing] = useState(null)
  const [version, setVersion] = useState(0)
  const [state, setState] = useState('active')
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [pages, setPages] = useState([])
  const lifecycle = useMutation()
  const resource = useResource(queryPath(path, { state, search, limit: 25, after: pages.at(-1) }))
  const items = resource.data?.items || []
  const editable = !archived && workspace.can('contacts.edit') && workspace.writesAllowed
  const canCreate = !archived && workspace.can('contacts.create') && workspace.writesAllowed
  const locked = lifecycle.pending || lifecycle.uncertain

  function changed() {
    resource.reload()
    setVersion(value => value + 1)
    reloadClient()
  }

  async function changeStatus(contact) {
    const restoring = contact.active === false
    if (!await askConfirm({
      title: restoring ? 'Restore contact?' : 'Archive contact?',
      message: restoring
        ? `Restore ${contact.name}? Previous defaults will stay cleared.`
        : `Archive ${contact.name}? Any primary or billing assignment will be cleared.`,
      confirmLabel: restoring ? 'Restore' : 'Archive',
      tone: restoring ? 'primary' : 'danger',
    })) return
    if (await lifecycle.run('post', `${path}/${contact._id}/${restoring ? 'restore' : 'archive'}`, {
      expectedVersion: contact.__v,
    })) changed()
  }

  const create = canCreate && <Action onClick={() => setEditing({})}><Plus size={16} aria-hidden="true" />Add contact</Action>

  return (
    <div className="client-contacts">
      <div className="client-contacts-heading">
        <h2>Contacts</h2>
        {create}
      </div>
      <ClientContactDefaults key={version} path={path} editable={editable} saved={reloadClient} />
      <div className="client-contacts-toolbar">
        <form className="client-contacts-search" onSubmit={event => {
          event.preventDefault()
          setSearch(draft.trim())
          setPages([])
        }}>
          <TextField label="Search contacts" type="search" value={draft} maxLength={80} placeholder="Name starts with…" title="Name search is case-sensitive." onChange={event => setDraft(event.target.value)} />
          <Action type="submit" variant="secondary" aria-label="Search contacts" title="Search contacts"><Search size={17} aria-hidden="true" /></Action>
          {search && <Action variant="icon-button" aria-label="Clear search" title="Clear search" onClick={() => {
            setSearch('')
            setDraft('')
            setPages([])
          }}><X size={17} aria-hidden="true" /></Action>}
        </form>
        <SelectField label="Status" value={state} searchable={false} onChange={event => {
          setState(event.target.value)
          setPages([])
        }}>
          <option value="active">Active</option>
          <option value="inactive">Archived</option>
          <option value="all">All contacts</option>
        </SelectField>
        <Action variant="secondary" aria-label="Refresh contacts" title="Refresh contacts" disabled={resource.loading} onClick={resource.reload}><RefreshCw size={17} aria-hidden="true" /></Action>
      </div>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      <ErrorNotice error={lifecycle.error} />
      <MutationRetry mutation={lifecycle} saved={changed} />
      {resource.loading ? <ListSkeleton label="Loading contacts…" columns={['Contact', 'Contact details', 'Status', 'Actions']} /> : items.length ? (
        <div className="table-scroll client-contacts-table-wrap">
          <table className="data-table client-contacts-table">
            <thead><tr><th scope="col">Contact</th><th scope="col">Contact details</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{items.map(contact => (
              <tr key={contact._id}>
                <td><strong>{contact.name}</strong>{contact.jobTitle && <small>{contact.jobTitle}</small>}</td>
                <td><div className="client-contact-channels">
                  {contact.email && <a className="app-link" href={`mailto:${contact.email}`}>{contact.email}</a>}
                  {contact.phone && <a className="app-link" href={`tel:+1${stripPhoneFormatting(formatNumber(contact.phone))}`}>{formatNumber(contact.phone)}</a>}
                  {!contact.email && !contact.phone && <span className="muted">No contact details</span>}
                </div></td>
                <td><Status value={contact.active === false ? 'archived' : 'active'} /></td>
                <td><div className="client-contact-actions">
                  {editable && contact.active !== false && <Action variant="icon-button" aria-label={`Edit ${contact.name}`} title="Edit contact" disabled={locked} onClick={() => setEditing(contact)}><Pencil size={16} aria-hidden="true" /></Action>}
                  {editable && <Action variant="icon-button" aria-label={`${contact.active === false ? 'Restore' : 'Archive'} ${contact.name}`} title={contact.active === false ? 'Restore contact' : 'Archive contact'} disabled={locked} onClick={() => changeStatus(contact)}>{contact.active === false ? <RotateCcw size={16} aria-hidden="true" /> : <Archive size={16} aria-hidden="true" />}</Action>}
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : !resource.error && <Empty title={search || state !== 'active' ? 'No matching contacts' : 'No contacts yet'}>
        {search ? 'Try another name prefix. Search is case-sensitive.' : state !== 'active' ? 'Try a different status.' : 'Add a contact to this client.'}
      </Empty>}
      {resource.data && (items.length > 0 || pages.length > 0) && <CursorPager count={items.length} label="contact" pages={pages} setPages={setPages} next={resource.data.next} />}
      {editing && <ContactEditor path={path} contact={editing} close={() => setEditing(null)} saved={() => {
        setEditing(null)
        changed()
      }} />}
    </div>
  )
}
