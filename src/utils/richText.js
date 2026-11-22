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
  if (/<hr\b/i.test(value || '')) return true
  return Boolean((value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&(?:nbsp|#0*160|#x0*a0);/gi, ' ')
    .trim())
}

/** Keep editor links and saved rich text on the same explicit protocol allowlist. */
export function isSafeRichTextUrl(value) {
  if (typeof value !== 'string' || Array.from(value).some(char => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)) return false
  if (!/^(?:https?:\/\/|mailto:|tel:)/i.test(value)) return false
  try {
    const url = new URL(value)
    if (url.protocol === 'http:' || url.protocol === 'https:') return Boolean(url.hostname)
    return Boolean(url.pathname)
  } catch {
    return false
  }
}
