import { createPortal } from 'react-dom'
import { GripVertical } from 'lucide-react'

export function ReferenceDragPreview({ drag, items }) {
  if (!drag) return null
  const width = Math.min(360, window.innerWidth - 32)
  const left = Math.max(16, Math.min(drag.x + 20, window.innerWidth - width - 16))
  const top = Math.max(16, Math.min(drag.y + 20, window.innerHeight - 224))
  const target = items.find((item) => item.id === drag.to)
  const fromIndex = items.findIndex((item) => item.id === drag.from)
  const toIndex = items.findIndex((item) => item.id === drag.to)

  return createPortal(
    <div
      className="reference-drag-preview"
      aria-hidden="true"
      style={{ width, transform: `translate3d(${left}px, ${top}px, 0)` }}
    >
      <div className="reference-drag-preview-heading">
        <GripVertical size={20} aria-hidden="true" />
        <div>
          <span className="reference-drag-preview-label">Moving entry</span>
          <strong>{drag.entry.label}</strong>
        </div>
      </div>
      {drag.entry.description && <p className="reference-drag-preview-description">{drag.entry.description}</p>}
      <p className="reference-drag-preview-destination">
        {target && target.id !== drag.from
          ? `Drop ${fromIndex < toIndex ? 'after' : 'before'} ${target.label}`
          : target ? 'Drag to a new position' : 'Move over a row to drop'}
      </p>
    </div>,
    document.body,
  )
}
