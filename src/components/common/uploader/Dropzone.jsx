import { useId, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { theme } from '@/crm-theme'
import { acceptAttribute } from './filePlaceholder'

/**
 * Keyboard-accessible drag & drop / click-to-browse surface.
 */
export function Dropzone({
  filePlaceholder,
  multiple = true,
  disabled = false,
  limitReached = false,
  onFiles,
  className = '',
}) {
  const inputRef = useRef(null)
  const inputId = useId()
  const [dragging, setDragging] = useState(false)
  const blocked = disabled || limitReached

  function openPicker() {
    if (blocked) return
    inputRef.current?.click()
  }

  function handleDrop(event) {
    event.preventDefault()
    setDragging(false)
    if (blocked) return
    const files = event.dataTransfer?.files
    if (files?.length) onFiles(files)
  }

  return (
    <div
      role="button"
      tabIndex={blocked ? -1 : 0}
      aria-disabled={blocked || undefined}
      aria-label={filePlaceholder.label}
      className={theme.cx(
        'file-dropzone',
        dragging && 'is-dragging',
        blocked && 'is-disabled',
        className,
      )}
      onClick={openPicker}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openPicker()
        }
      }}
      onDragEnter={(event) => {
        event.preventDefault()
        if (!blocked) setDragging(true)
      }}
      onDragOver={(event) => {
        event.preventDefault()
        if (!blocked) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="sr-only"
        tabIndex={-1}
        multiple={multiple}
        accept={acceptAttribute(filePlaceholder)}
        disabled={blocked}
        onChange={(event) => {
          const files = event.target.files
          if (files?.length) onFiles(files)
          event.target.value = ''
        }}
      />
      <Upload size={22} aria-hidden="true" />
      <p className="file-dropzone-title">{filePlaceholder.label}</p>
      {limitReached ? (
        <p className="muted">Maximum images reached</p>
      ) : (
        <p className="muted">
          {filePlaceholder.hint ||
            'Drag and drop, or press Enter to browse'}
        </p>
      )}
    </div>
  )
}
