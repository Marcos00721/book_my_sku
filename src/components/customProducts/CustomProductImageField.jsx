import { useState } from 'react'
import {
  Dropzone,
  FileCard,
  ImagePreviewModal,
  useObjectUrl,
  validateFile,
} from '../common/uploader'

const IMAGE_PLACEHOLDER = {
  label: 'Add product image',
  accept: ['image/jpeg', 'image/png', 'image/webp'],
  hint: 'Drag and drop or click to browse. JPG, PNG or WebP, up to 10 MB.',
}

export function CustomProductImageField({
  file,
  onChange,
  disabled = false,
  uploading = false,
  progress = 0,
  canUpload = true,
}) {
  const previewUrl = useObjectUrl(file)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [error, setError] = useState(null)

  function selectFile(files) {
    const selected = files[0]
    if (!selected || disabled || !canUpload) return
    const validation = validateFile({
      file: selected,
      placeholder: IMAGE_PLACEHOLDER,
      maxSizeMB: 10,
    })
    setError(validation.ok ? null : validation.error)
    if (validation.ok) onChange(selected)
  }

  return (
    <section className="custom-product-form-section custom-product-image-field" aria-label="Product image">
      <h3 className="custom-product-form-section-title">Product image (optional)</h3>
      <div className="custom-product-form-section-body">
        <p className="muted">
          {canUpload
            ? 'This image will be the product cover. You can add more images after creating the product.'
            : 'Product editing permission is required to upload images.'}
        </p>
        {file ? (
          <FileCard
            item={{
              id: 'product-cover',
              name: file.name,
              size: file.size,
              type: file.type,
              previewUrl,
              isCover: true,
              status: uploading ? 'uploading' : 'Ready to upload',
              progress,
            }}
            disabled={disabled}
            onPreview={() => setPreviewOpen(true)}
            onRemove={() => {
              setError(null)
              setPreviewOpen(false)
              onChange(null)
            }}
          />
        ) : (
          <Dropzone
            filePlaceholder={IMAGE_PLACEHOLDER}
            multiple={false}
            disabled={disabled || !canUpload}
            onFiles={selectFile}
          />
        )}
        {error ? <p className="field-error" role="alert">{error}</p> : null}
      </div>
      <ImagePreviewModal
        open={previewOpen}
        src={previewUrl}
        alt={file?.name}
        onClose={() => setPreviewOpen(false)}
      />
    </section>
  )
}
