/**
 * Shared section header used across client and supplier tabs.
 */
export function SectionHeading({ title, description, actions, children }) {
  return (
    <div className="section-heading">
      <div>
        {typeof title === 'string' || typeof title === 'number' ? (
          <h2>{title}</h2>
        ) : (
          title
        )}
        {description ? <p className="muted">{description}</p> : null}
      </div>
      {actions || children || null}
    </div>
  )
}
