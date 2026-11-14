import { FileCard } from './FileCard'

/**
 * Responsive grid of FileCards.
 */
export function FileList({
  items,
  disabled = false,
  showCoverAction = false,
  onPreview,
  onRemove,
  onRetry,
  onCancel,
  onSetCover,
  empty,
}) {
  if (!items.length) return empty || null

  return (
    <div className="file-list">
      {items.map((item) => (
        <FileCard
          key={item.id}
          item={item}
          disabled={disabled}
          showCoverAction={showCoverAction}
          onPreview={onPreview}
          onRemove={onRemove}
          onRetry={onRetry}
          onCancel={onCancel}
          onSetCover={onSetCover}
        />
      ))}
    </div>
  )
}
