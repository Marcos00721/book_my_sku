import { ButtonLink } from '../common/ButtonLink'
import { RichText } from '../common/RichText'

export function ClientNotes({ notes, editPath }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Notes</h2>
        {editPath && <ButtonLink variant="secondary" to={editPath}>Edit notes</ButtonLink>}
      </div>
      {notes ? <RichText value={notes} /> : <p className="muted">No notes yet.</p>}
    </section>
  )
}
