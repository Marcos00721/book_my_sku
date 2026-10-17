import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

/**
 * Dark / light mode toggle. Persists choice in localStorage and applies
 * the .dark class to <html>.  System preference is respected on first visit.
 *
 * @example
 *   <ThemeToggle />
 *   <ThemeToggle className="ml-auto" />
 */
export function ThemeToggle({ className = '' }) {
  const [isDark, setIsDark] = useState(
    () => document.documentElement.classList.contains('dark'),
  )

  useEffect(() => {
    const root = document.documentElement.classList
    if (isDark) {
      root.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      root.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [isDark])

  return (
    <button
      type="button"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setIsDark((d) => !d)}
      className={[
        'inline-flex size-touch items-center justify-center rounded-control',
        'text-text-muted motion-safe:transition-colors',
        'hover:bg-surface-muted hover:text-text-base',
        'focus-visible:shadow-focus focus-visible:outline-none',
        className,
      ].join(' ')}
    >
      {isDark ? (
        <Sun aria-hidden="true" className="size-icon" />
      ) : (
        <Moon aria-hidden="true" className="size-icon" />
      )}
    </button>
  )
}
