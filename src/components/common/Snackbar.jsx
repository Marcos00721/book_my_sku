import { useEffect, useRef, useState } from 'react'
import { AlertCircle, X } from 'lucide-react'
import '../../styles/snackbar.css'

const visibleSnackbars = new Set()

function positionSnackbars() {
  let bottom = 16
  for (const node of [...visibleSnackbars].reverse()) {
    node.style.setProperty('--snackbar-bottom', `${bottom}px`)
    bottom += node.getBoundingClientRect().height + 12
  }
}

/** Errors stay available until dismissed or their source clears them. */
export function Snackbar({ children }) {
  const ref = useRef(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (dismissed) return
    const node = ref.current
    // Show after a surrounding dialog enters the browser's top layer.
    const frame = requestAnimationFrame(() => {
      node.showPopover?.()
      visibleSnackbars.add(node)
      positionSnackbars()
    })
    const observer = new ResizeObserver(positionSnackbars)
    observer.observe(node)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      visibleSnackbars.delete(node)
      positionSnackbars()
    }
  }, [dismissed])

  if (dismissed) return null

  return (
    <div ref={ref} popover="manual" className="app-snackbar" role="alert" aria-atomic="true">
      <AlertCircle className="app-snackbar-icon" size={20} aria-hidden="true" />
      <div className="app-snackbar-content">{children}</div>
      <button
        type="button"
        className="app-snackbar-dismiss"
        aria-label="Dismiss error"
        onClick={() => {
          if (nodeContainsFocus(ref.current)) {
            ref.current.closest('dialog')?.querySelector('button[type="submit"]')?.focus()
          }
          setDismissed(true)
        }}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  )
}

function nodeContainsFocus(node) {
  return node?.contains(document.activeElement)
}
