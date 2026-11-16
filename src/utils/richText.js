const HTML_TAG = /<\/?[a-z][^>]*>/i

export function hasHtml(value) {
  return HTML_TAG.test(value || '')
}

/** Preserve line breaks and literal characters when loading older plain-text notes. */
export function toEditorHtml(value = '') {
  if (!value || hasHtml(value)) return value || ''
  const escaped = value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r\n|\r|\n/g, '<br>')
  return `<p>${escaped}</p>`
}

export function hasRichTextContent(value) {
  return Boolean(value
    .replace(/<[^>]*>/g, '')
    .replace(/&(?:nbsp|#0*160|#x0*a0);/gi, ' ')
    .trim())
}
