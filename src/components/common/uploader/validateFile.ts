import { acceptLabels, isAcceptedType } from './filePlaceholder'
import type { FilePlaceholder, UploadFileItem } from './types'

export interface ValidateFileOptions {
  file: File
  placeholder: FilePlaceholder
  maxSizeMB: number
  /** Existing items used for duplicate (name + size) checks. */
  existing?: Pick<UploadFileItem, 'name' | 'size'>[]
}

export type ValidateFileResult =
  | { ok: true }
  | { ok: false; error: string }

export function validateFile({
  file,
  placeholder,
  maxSizeMB,
  existing = [],
}: ValidateFileOptions): ValidateFileResult {
  if (!isAcceptedType(file, placeholder)) {
    const allowed = acceptLabels(placeholder)
    return {
      ok: false,
      error: `\`${file.name}\` is not allowed. Only ${allowed} accepted.`,
    }
  }

  const maxBytes = maxSizeMB * 1024 * 1024
  if (file.size > maxBytes) {
    return {
      ok: false,
      error: `\`${file.name}\` is too large. Maximum size is ${maxSizeMB} MB.`,
    }
  }

  const duplicate = existing.some(
    (item) => item.name === file.name && item.size === file.size,
  )
  if (duplicate) {
    return {
      ok: false,
      error: `\`${file.name}\` was skipped because it is already in the list.`,
    }
  }

  return { ok: true }
}

/** Validate a batch; keep valids, collect invalid messages. */
export function validateFiles(
  files: File[],
  options: Omit<ValidateFileOptions, 'file'> & {
    maxFiles?: number
    currentCount?: number
  },
): { valid: File[]; errors: string[] } {
  const errors: string[] = []
  const valid: File[] = []
  const seen = [...(options.existing || [])]
  const maxFiles = options.maxFiles
  let count = options.currentCount ?? seen.length

  for (const file of files) {
    if (maxFiles != null && count + valid.length >= maxFiles) {
      errors.push(`Maximum ${maxFiles} images reached.`)
      break
    }
    const result = validateFile({
      file,
      placeholder: options.placeholder,
      maxSizeMB: options.maxSizeMB,
      existing: seen,
    })
    if (!result.ok) {
      errors.push(result.error)
      continue
    }
    valid.push(file)
    seen.push({ name: file.name, size: file.size })
  }

  return { valid, errors }
}
