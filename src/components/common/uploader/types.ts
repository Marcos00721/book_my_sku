/** Accepted MIME types and UI copy for a dropzone. */
export interface FilePlaceholder {
  label: string
  accept: string[]
  hint?: string
}

export type FileUploadStatus =
  | 'pending'
  | 'uploading'
  | 'uploaded'
  | 'failed'

/** One file row in SingleUploader / MultipleUploader. */
export interface UploadFileItem {
  id: string
  name: string
  size: number
  type: string
  status: FileUploadStatus
  /** 0–100 while uploading; ignore when not uploading. */
  progress: number
  error?: string
  /** Local File when still client-side. */
  file?: File
  /** Object URL or short-lived server access URL for thumb/lightbox. */
  previewUrl?: string
  /** Server asset id after a successful PRODUCT-03 (or similar) upload. */
  assetId?: string
  /** True when the item came from the server, not a local pick. */
  remote?: boolean
  isCover?: boolean
}

export interface UploadHandlers {
  signal: AbortSignal
  onProgress: (percent: number) => void
}

/**
 * Injectable transport. Return a stable asset/server id on success.
 * Throw an Error (optionally with `.message`) on failure.
 */
export type UploadFileFn = (
  file: File,
  handlers: UploadHandlers,
) => Promise<{ assetId?: string; previewUrl?: string } | void>
