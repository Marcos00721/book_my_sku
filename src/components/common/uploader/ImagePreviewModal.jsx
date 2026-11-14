import { Modal } from '../Modal'

/** Lightbox for a single image preview URL. */
export function ImagePreviewModal({ open, title = 'Image preview', src, alt, onClose, children }) {
  if (!open || !src) return null

  return (
    <Modal title={title} close={onClose} className="image-preview-dialog">
      <figure className="image-preview-figure">
        <img
          src={src}
          alt={alt || title}
          referrerPolicy="no-referrer"
          onError={onClose}
        />
      </figure>
      {children}
    </Modal>
  )
}
