import { useState } from 'react'
import { ChevronRight, Search } from 'lucide-react'
import { useResource } from '../../hooks/useResource'
import { useMutation } from '../../hooks/useMutation'
import { Action, Dialog, Empty, ErrorNotice, Loading } from '../../components/workspace/Elements'
import { TextField } from '../../components/common/TextField'
import { CursorPager } from '../../components/workspace/CursorPager'
import { MutationRetry } from '../../components/workspace/RecordTools'
import { queryPath } from '../../services/workspace'

const PURPOSES = [{ key: 'primary', label: 'Primary contact' }, { key: 'billing', label: 'Billing contact' }]

function DefaultContact({ path, purpose, data, editable, disabled, choose }) {
  const id = data?.[`${purpose.key}ContactId`]
  const savedContact = data?.[`${purpose.key}Contact`]
  const name = savedContact?.name || savedContact?.label
  const contact = useResource(id && !name ? `${path}/${encodeURIComponent(id)}` : null)
  const value = id ? name || contact.data?.name || (contact.loading ? 'Loading…' : 'Contact unavailable') : 'Not set'
  const content = <><span className="client-contact-default-label">{purpose.label}</span><strong>{value}</strong></>
  return <div className="client-contact-default">
    {editable ? <button type="button" className="client-contact-default-button" disabled={disabled} aria-label={`Change ${purpose.label.toLowerCase()}`} onClick={choose}>
      <span>{content}</span><ChevronRight size={17} aria-hidden="true" />
    </button> : <div className="client-contact-default-value">{content}</div>}
    <ErrorNotice error={contact.error} retry={contact.reload} />
  </div>
}

function ContactPicker({ path, purpose, selectedId, locked, mutation, choose, close, changed, refreshDefaults }) {
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [pages, setPages] = useState([])
  const contacts = useResource(queryPath(path, { state: 'active', search, limit: 25, after: pages.at(-1) }))
  const items = contacts.data?.items || []
  return <Dialog size="md" className="client-form-dialog" title={purpose.label} close={close} locked={locked}>
    <div className="client-contact-picker">
      <form className="client-contacts-search" onSubmit={event => {
        event.preventDefault()
        setSearch(draft.trim())
        setPages([])
      }}>
        <TextField label="Find contact" type="search" value={draft} maxLength={80} placeholder="Name starts with…" title="Name search is case-sensitive." onChange={event => setDraft(event.target.value)} />
        <Action type="submit" variant="secondary" aria-label="Search contacts"><Search size={17} aria-hidden="true" /></Action>
      </form>
      <ErrorNotice error={contacts.error} retry={contacts.reload} />
      <ErrorNotice error={mutation.error} retry={refreshDefaults} />
      <MutationRetry mutation={mutation} saved={changed} />
      {selectedId && <Action variant="text-button" disabled={locked} onClick={() => choose(null)}>Clear {purpose.label.toLowerCase()}</Action>}
      {contacts.loading ? <Loading label="Loading contacts…" /> : items.length ? <ul className="client-contact-choices" aria-label="Available contacts">
        {items.map(contact => <li key={contact._id}><button type="button" disabled={locked} aria-pressed={selectedId === contact._id} onClick={() => choose(contact)}>
          <span><strong>{contact.name}</strong>{contact.email && <small>{contact.email}</small>}</span>
          {selectedId === contact._id ? <span className="muted">Selected</span> : <ChevronRight size={16} aria-hidden="true" />}
        </button></li>)}
      </ul> : !contacts.error && <Empty title="No matching contacts">{search ? 'Try another name prefix.' : 'Add an active contact first.'}</Empty>}
      {contacts.data && (items.length > 0 || pages.length > 0) && <CursorPager count={items.length} label="contact" pages={pages} setPages={setPages} next={contacts.data.next} />}
    </div>
  </Dialog>
}

export function ClientContactDefaults({ path, editable, saved }) {
  const defaults = useResource(`${path}/defaults`)
  const mutation = useMutation()
  const [purpose, setPurpose] = useState(null)
  const locked = mutation.pending || mutation.uncertain

  function changed() {
    defaults.reload()
    setPurpose(null)
    saved()
  }

  async function select(contact) {
    if (!purpose || !defaults.data || locked) return
    if (await mutation.run('patch', `${path}/defaults`, {
      expectedClientVersion: defaults.data.clientVersion,
      [purpose.key]: contact ? { contactId: contact._id, expectedVersion: contact.__v } : null,
    })) changed()
  }

  return <>
    <ErrorNotice error={defaults.error} retry={defaults.reload} />
    {!purpose && <ErrorNotice error={mutation.error} />}
    {!purpose && <MutationRetry mutation={mutation} saved={changed} />}
    {!defaults.error && <div className="client-contact-defaults" aria-label="Default contacts" aria-busy={defaults.loading}>
      {PURPOSES.map(item => <DefaultContact key={item.key} path={path} purpose={item} data={defaults.data} editable={editable} disabled={locked || defaults.loading || !defaults.data} choose={() => {
        mutation.reset()
        setPurpose(item)
      }} />)}
    </div>}
    {purpose && <ContactPicker path={path} purpose={purpose} selectedId={defaults.data?.[`${purpose.key}ContactId`]} mutation={mutation} locked={locked} choose={select} close={() => setPurpose(null)} changed={changed} refreshDefaults={defaults.reload} />}
  </>
}
