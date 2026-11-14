import type { FilePlaceholder } from './types'

/** Build the HTML `accept` attribute from MIME list. */
export function acceptAttribute(placeholder: FilePlaceholder): string {
  return placeholder.accept.join(',')
}

/** Human label list for errors, e.g. "JPG, PNG, WEBP". */
export function acceptLabels(placeholder: FilePlaceholder): string {
  return placeholder.accept
    .map((mime) => {
      const subtype = mime.split('/')[1] || mime
      if (subtype === 'jpeg') return 'JPG'
      return subtype.toUpperCase()
    })
    .join(', ')
}

export function isAcceptedType(
  file: File,
  placeholder: FilePlaceholder,
): boolean {
  if (!placeholder.accept.length) return true
  if (placeholder.accept.includes(file.type)) return true
  // Some browsers leave type empty — fall back to extension.
  const name = file.name.toLowerCase()
  return placeholder.accept.some((mime) => {
    const ext = mime.split('/')[1]
    if (!ext) return false
    if (ext === 'jpeg') return name.endsWith('.jpg') || name.endsWith('.jpeg')
    return name.endsWith(`.${ext}`)
  })
}
