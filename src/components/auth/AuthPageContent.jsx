import { useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

export function AuthPageContent({ id, title, eyebrow, description, children }) {
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    document.title = `${title} | BookMySku`
  }, [title])

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.35 }}
    >
      <header className="mb-xl">
        <p className="mb-sm text-xs font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>
        <h1 id={id} className="font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-sm text-sm leading-relaxed text-text-muted">{description}</p>
      </header>
      {children}
    </motion.div>
  )
}
