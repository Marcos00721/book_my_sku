import { useState } from 'react'
import { Image as ImageIcon, LayoutGrid, List, Star, X } from 'lucide-react'
import { Button, Tooltip } from '../common'
import { formatFileSize } from '../common/uploader/formatFileSize'
import { ProgressBar } from '../common/uploader/ProgressBar'
import '../../styles/product-media.css'

function ImageThumbnail({ item, onPreview, onDimensions }) {
  const [failedUrl, setFailedUrl] = useState(null)
  const available = item.previewUrl && failedUrl !== item.previewUrl
  return (
    <button type="button" className="product-image-thumb" disabled={!available}
      aria-label={`Preview ${item.name}`} onClick={() => onPreview?.(item)}>
      {available ? (
        <img src={item.previewUrl} alt={item.name} loading="lazy" decoding="async"
          referrerPolicy="no-referrer" onError={() => setFailedUrl(item.previewUrl)}
          onLoad={(event) => onDimensions(item.id, `${event.currentTarget.naturalWidth} × ${event.currentTarget.naturalHeight} px`)} />
      ) : <ImageIcon size={20} aria-hidden="true" />}
    </button>
  )
}

function ImageCoverAction({ item, disabled, showCoverAction, onSetCover }) {
  if (item.status !== 'uploaded') return null
  if (item.isCover) return (
    <Tooltip content={item.inherited ? 'Inherited product cover' : 'Current cover'}>
      <span className="product-image-cover">
        <Star size={14} fill="currentColor" aria-hidden="true" /> Cover
      </span>
    </Tooltip>
  )
  if (!showCoverAction) return null
  return (
    <Button size="sm" variant="secondary" className="product-image-set-cover"
      aria-label="Set as cover" title="Set as cover" disabled={disabled || item.actionsDisabled}
      onClick={() => onSetCover?.(item)}>
      <Star size={14} aria-hidden="true" /><span>Set as cover</span>
    </Button>
  )
}

function ImageActions({ item, disabled, showCoverAction, onSetCover, onRemove, onRetry, onCancel }) {
  const blocked = disabled || item.actionsDisabled
  return (
    <div className="product-image-actions">
      <ImageCoverAction item={item} disabled={disabled} showCoverAction={showCoverAction} onSetCover={onSetCover} />
      {item.status === 'failed' && !item.remote && (
        <Button size="sm" variant="secondary" disabled={disabled} onClick={() => onRetry?.(item)}>Retry upload</Button>
      )}
      {item.status === 'uploading' && (
        <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onCancel?.(item)}>Cancel upload</Button>
      )}
      {onRemove && item.status !== 'uploading' && (!item.remote || item.canRemove) && (
        <Button size="sm" variant="ghost" disabled={blocked} aria-label={`${item.removeLabel || 'Remove'} ${item.name}`}
          onClick={() => onRemove(item)}>
          <X size={14} aria-hidden="true" /> {item.removeLabel || 'Remove'}
        </Button>
      )}
      {item.remote && !showCoverAction ? <span className="muted">View only</span> : null}
    </div>
  )
}

function ImageDetails({ item, dimensions }) {
  const details = [
    ['File size', item.size > 0 ? formatFileSize(item.size) : '—'],
    ['Dimensions', dimensions || '—'],
  ]
  return (
    <dl className="product-image-details">
      {details.map(([label, value]) => (
        <div key={label}><dt>{label}</dt><Tooltip content={value}><dd>{value}</dd></Tooltip></div>
      ))}
    </dl>
  )
}

/** Keep management controls in the full preview, leaving the library compact. */
export function ProductImagePreviewContent({ item, ...actions }) {
  if (!item) return null
  return <div className="product-image-preview-controls">
    <ImageFeedback item={item} />
    <ImageActions item={item} {...actions} />
  </div>
}

function ImageFeedback({ item }) {
  return <>
    {item.status === 'uploading' && <ProgressBar value={item.progress} label={`Uploading ${item.name}`} />}
    {item.error && <p className="field-error" role="alert">{item.error}</p>}
  </>
}

/** Compact image details with cover assignment available in either view. */
export function ProductImageList({ items, empty, onPreview, toolbar, ...actions }) {
  const [view, setView] = useState(() => {
    try { return localStorage.getItem('product-images-view') === 'cards' ? 'cards' : 'table' }
    catch { return 'table' }
  })
  const [dimensions, setDimensions] = useState({})
  function changeView(value) {
    setView(value)
    try { localStorage.setItem('product-images-view', value) }
    catch { /* Layout switching also works when browser storage is unavailable. */ }
  }
  function recordDimensions(id, value) {
    setDimensions((current) => current[id] === value ? current : { ...current, [id]: value })
  }
  const thumbnail = (item) => <ImageThumbnail item={item} onPreview={onPreview} onDimensions={recordDimensions} />

  return (
    <section className="product-image-library" aria-label="Product image library">
      <div className="product-image-toolbar">
        <div><h3>Image library <span className="muted">({items.length})</span></h3>
          <p className="muted">Select a thumbnail to preview the full image.</p></div>
        <div className="product-image-toolbar-controls">
          {toolbar}
          <div className="product-image-view-switch" role="group" aria-label="Image view">
          <Button size="sm" aria-label="Table" title="Table view" variant={view === 'table' ? 'secondary' : 'ghost'} aria-pressed={view === 'table'} onClick={() => changeView('table')}>
            <List size={16} aria-hidden="true" /><span className="product-image-view-label">Table</span>
          </Button>
          <Button size="sm" aria-label="Cards" title="Card view" variant={view === 'cards' ? 'secondary' : 'ghost'} aria-pressed={view === 'cards'} onClick={() => changeView('cards')}>
            <LayoutGrid size={16} aria-hidden="true" /><span className="product-image-view-label">Cards</span>
          </Button>
          </div>
        </div>
      </div>
      {!items.length ? empty : view === 'table' ? (
        <div className="product-image-table-scroll" role="region" aria-label="Images table" tabIndex={0}>
          <table className="product-image-table">
            <caption className="sr-only">Product images, file sizes and dimensions</caption>
            <thead><tr><th scope="col">Image</th><th scope="col">File size</th><th scope="col">Dimensions</th><th scope="col">Cover</th></tr></thead>
            <tbody>{items.map((item) => (
              <tr key={item.id}>
                <td>{thumbnail(item)}</td>
                <td>{item.size > 0 ? formatFileSize(item.size) : '—'}</td>
                <td>{dimensions[item.id] || '—'}</td>
                <td><ImageCoverAction item={item} {...actions} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <div className="product-image-grid">{items.map((item) => (
          <article className="product-image-card" key={item.id} aria-label={item.name}>
            {thumbnail(item)}
            <ImageDetails item={item} dimensions={dimensions[item.id]} />
            {item.status === 'uploaded' && (item.isCover || actions.showCoverAction) && (
              <div className="product-image-card-cover"><ImageCoverAction item={item} {...actions} /></div>
            )}
          </article>
        ))}</div>
      )}
      {items.filter((item) => !item.remote && item.status !== 'uploaded').map((item) => (
        <div className="product-image-upload-feedback" key={item.id}>
          <ImageFeedback item={item} />
          <ImageActions item={item} {...actions} />
        </div>
      ))}
    </section>
  )
}
