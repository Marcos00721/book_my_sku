import { Image as ImageIcon, X } from 'lucide-react'
import { theme } from '@/crm-theme'
import { Badge } from '../Badge'
import { Button } from '../Button'
import { formatFileSize } from './formatFileSize'
import { ProgressBar } from './ProgressBar'

const STATUS_LABEL = {
  pending: 'Pending',
  uploading: 'Uploading',
  uploaded: 'Uploaded',
  failed: 'Failed',
}

/**
 * One file row/card: thumb, name, size, status, actions.
 */
export function FileCard({
  item,
  disabled = false,
  onPreview,
  onRemove,
  onRetry,
  onCancel,
  onSetCover,
  showCoverAction = false,
}) {
  const status = STATUS_LABEL[item.status] || item.status
  const canRemove = !disabled && typeof onRemove === 'function'
  const uploading = item.status === 'uploading'

  return (
    <article className="file-card">
      <button
        type="button"
        className="file-card-thumb"
        onClick={() => item.previewUrl && onPreview?.(item)}
        disabled={!item.previewUrl}
        aria-label={`Preview ${item.name}`}
      >
        {item.previewUrl ? (
          <img src={item.previewUrl} alt={item.name} />
        ) : (
          <ImageIcon size={28} aria-hidden="true" />
        )}
      </button>

      <div className="file-card-body">
        <div className="file-card-heading">
          <p className="file-card-name" title={item.name}>
            {item.name}
          </p>
          {item.isCover ? <Badge tone="primary">Cover</Badge> : null}
        </div>
        <p className="muted">
          {item.size > 0 ? `${formatFileSize(item.size)} · ` : ''}
          {status}
        </p>

        {uploading ? (
          <ProgressBar value={item.progress} label={`Uploading ${item.name}`} />
        ) : null}

        {item.error ? (
          <p className="field-error" role="alert">
            {item.error}
          </p>
        ) : null}

        <div className={theme.cx('file-card-actions', 'actions')}>
          {showCoverAction &&
            item.status === 'uploaded' &&
            !item.isCover &&
            !disabled && (
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => onSetCover?.(item)}
              >
                Set as cover
              </Button>
            )}
          {item.status === 'failed' && !disabled && (
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => onRetry?.(item)}
            >
              Retry
            </Button>
          )}
          {uploading && !disabled && (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => onCancel?.(item)}
            >
              Cancel
            </Button>
          )}
          {canRemove && !uploading && (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              aria-label={`Remove ${item.name}`}
              onClick={() => onRemove(item)}
            >
              <X size={16} aria-hidden="true" />
              Remove
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}
