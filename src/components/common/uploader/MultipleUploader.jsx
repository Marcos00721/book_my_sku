import { useEffect, useRef, useState } from 'react'
import { theme } from '@/crm-theme'
import { Dropzone } from './Dropzone'
import { FileList } from './FileList'
import { ImagePreviewModal } from './ImagePreviewModal'
import { useFileUpload } from './useFileUpload'

/**
 * Multi-file image uploader with progress, retry, and cover actions.
 *
 * @param {object} props
 * @param {import('./types').FilePlaceholder} props.filePlaceholder
 * @param {number} [props.maxSizeMB]
 * @param {number} [props.maxFiles]
 * @param {boolean} [props.disabled]
 * @param {string} [props.error]
 * @param {string} [props.label]
 * @param {import('./types').UploadFileItem[]} [props.existing]
 * @param {import('./types').UploadFileFn} [props.uploadFile]
 * @param {(item: import('./types').UploadFileItem) => void} [props.onRemove]
 * @param {(item: import('./types').UploadFileItem) => void} [props.onSetCover]
 * @param {(busy: boolean) => void} [props.onBusyChange]
 * @param {() => void} [props.onUploaded]
 * @param {import('react').ComponentType} [props.ListComponent] Optional custom presentation of the shared upload queue.
 * @param {import('react').ComponentType} [props.PreviewContent] Optional controls below the full image preview.
 * @param {import('react').ReactNode} [props.listToolbar] Optional controls beside the list view switch.
 */
export function MultipleUploader({
  filePlaceholder,
  maxSizeMB = 5,
  maxFiles = 8,
  disabled = false,
  readOnly = false,
  error,
  label,
  existing = [],
  uploadFile,
  onRemove,
  onSetCover,
  onBusyChange,
  onUploaded,
  ListComponent = FileList,
  PreviewContent,
  listToolbar,
}) {
  const {
    items,
    localItems,
    batchError,
    busy,
    addFiles,
    removeLocal,
    retry,
    cancel,
    clearUploadedLocals,
  } = useFileUpload({
    filePlaceholder,
    maxSizeMB,
    maxFiles,
    multiple: true,
    disabled,
    uploadFile,
    existing,
  })

  const [preview, setPreview] = useState(null)
  const prevBusy = useRef(false)
  const uploadedCount = useRef(0)

  useEffect(() => {
    onBusyChange?.(busy)
  }, [busy, onBusyChange])

  useEffect(() => {
    const done = localItems.filter((item) => item.status === 'uploaded').length
    if (done > uploadedCount.current) {
      uploadedCount.current = done
      onUploaded?.()
      clearUploadedLocals()
    }
    if (!busy && prevBusy.current) {
      uploadedCount.current = 0
    }
    prevBusy.current = busy
  }, [busy, clearUploadedLocals, localItems, onUploaded])

  const limitReached = items.length >= maxFiles
  const remoteReady = existing.filter((item) => item.status === 'uploaded')
    .length
  const displayError = error || batchError

  return (
    <div className={theme.cx('file-uploader', 'file-uploader--multiple')}>
      {label ? <p className={theme.label}>{label}</p> : null}

      {!readOnly && <Dropzone
        filePlaceholder={filePlaceholder}
        multiple
        disabled={disabled}
        limitReached={limitReached}
        onFiles={addFiles}
      />}

      <p className="muted file-uploader-summary" aria-live="polite">
        {remoteReady} of {maxFiles} images uploaded
        {busy ? ' · Uploading…' : ''}
      </p>

      <ListComponent
        items={items}
        toolbar={listToolbar}
        disabled={disabled}
        showCoverAction={Boolean(onSetCover)}
        empty={
          !items.length ? (
            <p className="muted file-uploader-empty">
              No images yet. Drop photos above to get started.
            </p>
          ) : null
        }
        onPreview={(item) =>
          setPreview({ id: item.id, src: item.previewUrl, alt: item.name })
        }
        onRemove={(item) => {
          if (item.remote) onRemove?.(item)
          else removeLocal(item.id)
        }}
        onRetry={(item) => retry(item.id)}
        onCancel={(item) => cancel(item.id)}
        onSetCover={onSetCover}
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
      >
        {PreviewContent && <PreviewContent
          item={items.find((item) => item.id === preview?.id)}
          disabled={disabled}
          showCoverAction={Boolean(onSetCover)}
          onSetCover={onSetCover}
          onRemove={(item) => {
            if (item.remote) onRemove?.(item)
            else { removeLocal(item.id); setPreview(null) }
          }}
        />}
      </ImagePreviewModal>
    </div>
  )
}
