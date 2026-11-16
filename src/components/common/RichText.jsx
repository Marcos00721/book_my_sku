import { createElement, useMemo } from 'react'
import { hasHtml } from '../../utils/richText'

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 's', 'strike', 'del', 'u',
  'ul', 'ol', 'li', 'code', 'pre', 'blockquote', 'h1', 'h2', 'h3',
  'h4', 'h5', 'h6', 'div', 'span',
])
const HIDDEN_TAGS = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'svg', 'math',
  'template', 'noscript',
])

function renderNode(node, key) {
  if (node.nodeType === 3) return node.textContent
  if (node.nodeType !== 1) return null
  const tag = node.localName
  if (HIDDEN_TAGS.has(tag)) return null
  const children = Array.from(node.childNodes, (child, index) => renderNode(child, index))
  if (tag === 'a') {
    const href = node.getAttribute('href') || ''
    if (/^(?:https?:\/\/|mailto:|tel:)/i.test(href)) {
      return createElement('a', { key, href, className: 'app-link', target: '_blank', rel: 'noopener noreferrer' }, children)
    }
    return children
  }
  if (!ALLOWED_TAGS.has(tag)) return children
  const props = { key }
  if (tag === 'ol' && /^\d+$/.test(node.getAttribute('start') || '')) {
    props.start = Number(node.getAttribute('start'))
  }
  return tag === 'br'
    ? createElement(tag, props)
    : createElement(tag, props, children)
}

/** Render only supported formatting, without injecting stored HTML into the page. */
export function RichText({ value = '', className = '' }) {
  const content = useMemo(() => {
    if (!hasHtml(value)) return value
    const document = new DOMParser().parseFromString(value, 'text/html')
    return Array.from(document.body.childNodes, (node, index) => renderNode(node, index))
  }, [value])

  return <div className={`rich-text ${className}`.trim()}>{content}</div>
}
