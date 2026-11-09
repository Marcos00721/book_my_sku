import { ShieldCheck } from 'lucide-react'
import { ThemeToggle } from '../ui/ThemeToggle'
import { BrandMark } from './BrandMark'

export function AuthLayout({ variant, tone, children }) {
  const shellClass = ['auth-shell', `auth-${variant}`, tone && `auth-${tone}`]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={shellClass}>
      <div className="auth-theme">
        <ThemeToggle />
      </div>
      <main className="auth-main">
        <div className="auth-form-wrap">
          <div className="auth-form" key={variant}>
            <div className="auth-brand">
              <BrandMark />
            </div>
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
