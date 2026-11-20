import { useEffect, useRef } from 'react'
import { GripVertical } from 'lucide-react'

export function ReferenceDragHandle({ entry, items, disabled, dragging, move }) {
  const buttonRef = useRef(null)
  const restoreFocusRef = useRef(false)

  useEffect(() => {
    if (!disabled && restoreFocusRef.current) {
      buttonRef.current?.focus()
      restoreFocusRef.current = false
    }
  }, [disabled])

  return (
    <button
      ref={buttonRef}
      type="button"
      className="reference-drag-handle"
      aria-label={`Reorder ${entry.label}`}
      aria-describedby="reference-order-instructions"
      aria-keyshortcuts="ArrowUp ArrowDown"
      aria-pressed={dragging}
      disabled={disabled}
      onKeyDown={(event) => {
        if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return
        event.preventDefault()
        if (dragging) return
        const index = items.findIndex((item) => item.id === entry.id)
        const target = items[index + (event.key === 'ArrowUp' ? -1 : 1)]
        if (target) {
          restoreFocusRef.current = true
          void move(entry.id, target.id)
        }
      }}
    >
      <GripVertical size={18} aria-hidden="true" />
    </button>
  )
}
