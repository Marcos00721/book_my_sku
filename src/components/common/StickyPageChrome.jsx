import { PageHeader } from './PageHeader'
import { theme } from '@/crm-theme'

/**
 * Sticky page chrome: keeps the header (and optional tabs) pinned under the
 * workspace topbar while the page body scrolls.
 */
export function StickyPageChrome({
  before,
  eyebrow,
  title,
  description,
  actions,
  meta,
  tabs,
  children,
  className = '',
}) {
  const showHeader = title != null && title !== ''

  return (
    <div className={theme.cx('sticky-page', className)}>
      <div className="sticky-page-chrome">
        {before ? <div className="sticky-page-before">{before}</div> : null}
        {showHeader ? (
          <PageHeader
            eyebrow={eyebrow}
            title={title}
            description={description}
            actions={actions}
          />
        ) : null}
        {meta ? <div className="sticky-page-meta">{meta}</div> : null}
        {tabs ? <PageTabs {...tabs} /> : null}
      </div>
      <div className="sticky-page-body">{children}</div>
    </div>
  )
}

export function PageTabs({ label, items = [], value, onChange }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={value === item.value}
          disabled={item.disabled}
          onClick={() => onChange?.(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
