import { useState } from 'react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useMutation } from '../../hooks/useMutation'
import { useResource } from '../../hooks/useResource'
import { leadConversionSchema } from '../../schemas/leadFormSchema'
import { acceptedLead } from '../../services/leads'
import { queryPath } from '../../services/workspace'
import { AppFormProvider } from '../forms/AppFormProvider'
import { FormTextField } from '../forms/FormTextField'
import { useAppForm } from '../forms/useAppForm'
import { Action, Dialog, ErrorNotice, Field, Loading, SaveFooter } from '../workspace/Elements'
import { LeadConflictReview } from './LeadConflictReview'
import { RichText } from '../common/RichText'

export function LeadConversion({ path, lead, close, saved }) {
  const workspace = useWorkspace()
  const [record, setRecord] = useState(lead)
  const [assignments, setAssignments] = useState({})
  const mutation = useMutation()
  const locked = mutation.pending || mutation.uncertain
  const form = useAppForm(leadConversionSchema, { defaultValues: { name: acceptedLead(lead).companyName } })
  const options = useResource(workspace.can('projects.edit')
    ? queryPath(`${workspace.base}/assignment-options`, { purpose: 'project', clientId: record.clientId, limit: 50 }) : null)
  const eligible = record.stage === 'qualified' && Boolean(record.clientId)

  async function submit(values) {
    if (!mutation.uncertain && (!eligible || mutation.error?.status === 409 || !workspace.writesAllowed)) return
    const result = await mutation.run('post', `${path}/convert`, { expectedRevision: record.revision, name: values.name, ...assignments })
    if (result) saved(result.data)
  }

  return (
    <Dialog title="Convert lead to project" size="md" close={close} locked={locked} hasUnsavedChanges={form.formState.isDirty || Object.keys(assignments).length > 0 || mutation.uncertain}
      description="Create a project using the selected client and accepted requirement. Conversion is final.">
      <AppFormProvider form={form} onSubmit={submit} animated={false} className="lead-form">
        <FormTextField name="name" label="Project name" required maxLength={160} disabled={locked} />
        <p className="muted">The selected contact and requested in-hands date carry into the project. The project owner defaults to you.</p>
        {!eligible && <p className="notice">The latest lead must be qualified with a selected client before conversion.</p>}
        {workspace.can('projects.edit') && <details className="lead-optional-fields">
          <summary>Project assignments (optional)</summary>
          <ErrorNotice error={options.error} retry={options.reload} />
          {['ownerId', 'clientRepId', 'orderRepId', 'productionRepId'].map(key => (
            <Field key={key} label={({ ownerId: 'Project owner', clientRepId: 'Client representative', orderRepId: 'Order representative', productionRepId: 'Production representative' })[key]}
              value={assignments[key] || ''} disabled={locked || options.loading || Boolean(options.error)}
              onChange={event => setAssignments(current => {
                const next = { ...current }
                if (event.target.value) next[key] = event.target.value
                else delete next[key]
                return next
              })}>
              <option value="">{key === 'ownerId' ? 'Assign to me' : 'Not assigned'}</option>
              {(options.data?.items || []).map(item => <option key={item.actorId} value={item.actorId}>{item.label}</option>)}
            </Field>
          ))}
          {options.data?.clientRepSuggestion && <p className="muted">Suggested client representative: {options.data.clientRepSuggestion.label || 'Client account manager'}. Select explicitly to assign.</p>}
        </details>}
        <LeadConflictReview error={mutation.error} path={path} draft={{ name: form.getValues('name') }}
          onReview={current => {
            if (current.stage === 'converted') { saved({ alreadyConverted: true }); return }
            setRecord(current)
            mutation.reset()
          }} />
        <SaveFooter mutation={mutation} close={close} label="Convert to project"
          disabled={!mutation.uncertain && (!eligible || mutation.error?.status === 409 || !workspace.writesAllowed)}
          onClear={() => setAssignments({})} />
      </AppFormProvider>
    </Dialog>
  )
}

export function LinkedLeadProject({ lead, reference }) {
  const workspace = useWorkspace()
  const [pages, setPages] = useState([])
  const [open, setOpen] = useState(false)
  const directory = useResource(!reference && workspace.can('projects.view')
    ? queryPath(`${workspace.base}/projects`, { clientId: lead.clientId, limit: 50, before: pages.length ? JSON.stringify(pages.at(-1)) : undefined }) : null)
  const project = directory.data?.items?.find(item => item._id === lead.projectId)
  const resolved = reference || project?.reference
  const detail = useResource(open && resolved && workspace.can('projects.view') ? `${workspace.base}/projects/${resolved}` : null)
  return (
    <div className="notice">
      <strong>Converted to project{resolved ? ` · ${resolved}` : ''}</strong>
      {workspace.can('projects.view') && <>
        <ErrorNotice error={directory.error} retry={directory.reload} />
        {directory.loading && <Loading variant="inline" label="Finding linked project…" />}
        {resolved ? <p><Action variant="secondary" onClick={() => setOpen(true)}>View linked project</Action></p>
          : directory.data?.next ? <p><Action variant="secondary" onClick={() => setPages(current => [...current, directory.data.next])}>Find in older projects</Action></p>
            : directory.data && <p>The linked project is currently unavailable.</p>}
      </>}
      {open && <Dialog title="Linked project" close={() => setOpen(false)} size="md">
        <ErrorNotice error={detail.error} retry={detail.reload} />
        {detail.loading ? <Loading variant="detail" label="Loading project…" /> : detail.data && <>
          <h3>{detail.data.name}</h3><p className="muted">{detail.data.reference}</p>
          <p>Requested in-hands date: {detail.data.requestedInHandsDate || 'Not provided'}</p>
          <RichText value={detail.data.brief || ''} />
        </>}
      </Dialog>}
    </div>
  )
}

