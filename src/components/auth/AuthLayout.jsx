import { ShieldCheck } from 'lucide-react'
import { ThemeToggle } from '../ui/ThemeToggle'
import { BrandMark } from './BrandMark'

export function AuthLayout({ variant, tone, children }) {
  const shellClass = ['auth-shell', `auth-${variant}`, tone && `auth-${tone}`]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={shellClass}>
      <main className="auth-main">
        <header className="auth-top">
          <BrandMark />
          <ThemeToggle />
        </header>
        <div className="auth-form-wrap">
          <div className="auth-form" key={variant}>
            {children}
          </div>
        </div>
        <footer className="auth-footer">
          <ShieldCheck size={14} />
          <span>Secure access to your business workspace</span>
        </footer>
      </main>
    </div>
  )
}
