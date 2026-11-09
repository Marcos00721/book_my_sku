import { useEffect } from 'react'
import { theme } from '@/crm-theme'

export function PageHeader({ eyebrow, title, description, actions }) {
  useEffect(() => {
    document.title = `${title} | BookMySku`
  }, [title])

  return (
    <header className="page-heading">
      <div>
        {eyebrow ? (
          <p className={theme.cx('eyebrow', theme.pageEyebrow)}>{eyebrow}</p>
        ) : null}
        <h1 className={theme.pageTitle}>{title}</h1>
        {description ? (
          <p className={theme.cx('muted', theme.pageDescription)}>{description}</p>
        ) : null}
      </div>
      {actions ? <div className="actions">{actions}</div> : null}
    </header>
  )
}
