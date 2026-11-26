import { useResource } from '../../hooks/useResource'
import { acceptedLead, leadFields, leadStages } from '../../services/leads'
import { RichText } from '../common/RichText'
import { Action, ErrorNotice, Loading } from '../workspace/Elements'

export function LeadConflictReview({ error, path, draft, onReview }) {
  const active = error?.status === 409
  const current = useResource(active ? path : null)
  if (!active) return null
  return (
    <section className="notice lead-conflict" aria-label="Review lead conflict">
      <h3>This lead changed</h3>
      <p>Your draft is preserved. Review the latest record before saving again.</p>
      <ErrorNotice error={current.error} retry={current.reload} />
      {current.loading ? <Loading variant="inline" label="Loading latest lead…" /> : current.data && <>
        <p>Current stage: <strong>{leadStages[current.data.stage]?.label || 'Unknown'}</strong></p>
        <div className="table-scroll"><table className="data-table">
          <thead><tr><th>Field</th><th>Current</th><th>Your draft</th></tr></thead>
          <tbody>{Object.entries(draft).map(([field, value]) => <tr key={field}>
            <th>{leadFields[field] || ({ ownerId: 'Lead owner', clientId: 'Client', contactId: 'Client contact', name: 'Project name' })[field] || field}</th>
            <td>{field === 'requirement' ? <RichText value={acceptedLead(current.data)[field]} /> : String(acceptedLead(current.data)[field] ?? current.data[field] ?? 'Not set')}</td>
            <td>{field === 'requirement' ? <RichText value={value} /> : value || 'Not set'}</td>
          </tr>)}</tbody>
        </table></div>
        <Action variant="secondary" onClick={() => onReview(current.data)}>Use latest revision and keep my edits</Action>
      </>}
    </section>
  )
}
