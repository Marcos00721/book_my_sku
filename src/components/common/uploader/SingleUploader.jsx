import { useEffect, useState } from 'react'
import { theme } from '@/crm-theme'
import { Dropzone } from './Dropzone'
import { FileList } from './FileList'
import { ImagePreviewModal } from './ImagePreviewModal'
import { useFileUpload } from './useFileUpload'

/**
 * One-file uploader (cover / avatar style).
 *
 * @param {object} props
 * @param {import('./types').FilePlaceholder} props.filePlaceholder
 * @param {number} [props.maxSizeMB]
 * @param {boolean} [props.disabled]
 * @param {string} [props.error]
 * @param {string} [props.label]
 * @param {import('./types').UploadFileItem | null} [props.value]
 * @param {(item: import('./types').UploadFileItem | null) => void} [props.onChange]
 * @param {import('./types').UploadFileFn} [props.uploadFile]
 * @param {() => void} [props.onRemove]
 */
export function SingleUploader({
  filePlaceholder,
  maxSizeMB = 5,
  disabled = false,
  error,
  label,
  value = null,
  onChange,
  uploadFile,
  onRemove,
}) {
  const existing = value ? [value] : []
  const {
    items,
    localItems,
    batchError,
    busy,
    addFiles,
    removeLocal,
    retry,
    cancel,
  } = useFileUpload({
    filePlaceholder,
    maxSizeMB,
    maxFiles: 1,
    multiple: false,
    disabled,
    uploadFile,
    existing,
  })

  const [preview, setPreview] = useState(null)

  useEffect(() => {
    const latest = localItems[0]
    if (!latest || !onChange) return
    if (latest.status === 'uploaded' || latest.status === 'failed') {
      onChange(latest)
    }
  }, [localItems, onChange])

  const displayError = error || batchError

  return (
    <div className={theme.cx('file-uploader', 'file-uploader--single')}>
      {label ? <p className={theme.label}>{label}</p> : null}

      {!value && !localItems.length ? (
        <Dropzone
          filePlaceholder={filePlaceholder}
          multiple={false}
          disabled={disabled || busy}
          onFiles={addFiles}
        />
      ) : null}

      <FileList
        items={items}
        disabled={disabled}
        onPreview={(item) =>
          setPreview({ src: item.previewUrl, alt: item.name })
        }
        onRemove={(item) => {
          if (item.remote) onRemove?.()
          else removeLocal(item.id)
          onChange?.(null)
        }}
        onRetry={(item) => retry(item.id)}
        onCancel={(item) => cancel(item.id)}
      />

      {displayError ? (
        <p className="field-error" role="alert" aria-live="polite">
          {displayError}
        </p>
      ) : null}

      <ImagePreviewModal
        open={Boolean(preview)}
        src={preview?.src}
        alt={preview?.alt}
        onClose={() => setPreview(null)}
      />
    </div>
  )
}
