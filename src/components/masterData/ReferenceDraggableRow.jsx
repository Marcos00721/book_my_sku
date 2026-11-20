import { useEffect, useRef } from 'react'
import { DraggableCore } from 'react-draggable'

function pointerPosition(event) {
  const pointer = event.touches?.[0] || event.changedTouches?.[0] || event
  return { x: pointer.clientX, y: pointer.clientY }
}

export function ReferenceDraggableRow({ entry, disabled, drag, setDrag, move, children, ...rowProps }) {
  const nodeRef = useRef(null)
  const sessionRef = useRef(null)
  const active = drag?.from === entry.id

  useEffect(() => {
    if (!active) return
    function cancel(event) {
      if (event.type === 'keydown' && event.key !== 'Escape') return
      if (event.type === 'keydown') {
        event.preventDefault()
        event.stopPropagation()
      }
      sessionRef.current = null
      setDrag(null)
    }
    document.addEventListener('keydown', cancel, true)
    document.addEventListener('touchcancel', cancel, true)
    window.addEventListener('blur', cancel)
    return () => {
      document.removeEventListener('keydown', cancel, true)
      document.removeEventListener('touchcancel', cancel, true)
      window.removeEventListener('blur', cancel)
    }
  }, [active, setDrag])

  function targetAt({ x, y }) {
    const row = document.elementFromPoint(x, y)?.closest('tr[data-reference-id]')
    return row?.closest('table') === nodeRef.current?.closest('table')
      ? row?.dataset.referenceId || null
      : null
  }

  return (
    <DraggableCore
      nodeRef={nodeRef}
      handle=".reference-drag-handle"
      disabled={disabled || Boolean(drag && !active)}
      onStart={(event) => {
        const point = pointerPosition(event)
        sessionRef.current = { from: entry.id, entry }
        setDrag({ ...sessionRef.current, ...point, to: entry.id })
      }}
      onDrag={(event) => {
        if (!sessionRef.current) return false
        const point = pointerPosition(event)
        setDrag({ ...sessionRef.current, ...point, to: targetAt(point) })
        if (point.y > window.innerHeight - 60) window.scrollBy(0, 16)
        else if (point.y < 120) window.scrollBy(0, -16)
      }}
      onStop={(event) => {
        const session = sessionRef.current
        sessionRef.current = null
        setDrag(null)
        if (!session || event.type === 'touchcancel') return
        const to = targetAt(pointerPosition(event))
        if (to && to !== session.from) void move(session.from, to)
      }}
    >
      <tr {...rowProps} ref={nodeRef}>{children}</tr>
    </DraggableCore>
  )
}
