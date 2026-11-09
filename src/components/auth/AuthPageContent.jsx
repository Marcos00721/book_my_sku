import { useEffect } from 'react'
import { theme } from '@/crm-theme'

export function AuthPageContent({ id, title, eyebrow, description, children }) {
  useEffect(() => {
    document.title = `${title} | BookMySku`
  }, [title])

  return (
    <div>
      <header className="mb-xl">
        <p className={theme.pageEyebrow}>{eyebrow}</p>
        <h1 id={id} className={theme.cx(theme.pageTitle, 'leading-tight')}>
          {title}
        </h1>
        <p className={theme.pageDescription}>{description}</p>
      </header>
      {children}
    </div>
  )
}
