import { useEffect } from 'react'

export function AuthPageContent({ id, title, eyebrow, description, children }) {
  useEffect(() => {
    document.title = `${title} | BookMySku`
  }, [title])

  return (
    <div>
      <header className="mb-xl">
        <p className="mb-sm text-xs font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>
        <h1 id={id} className="font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-sm text-sm leading-relaxed text-text-muted">{description}</p>
      </header>
      {children}
    </div>
  )
}
