import { ShieldCheck } from 'lucide-react'
import { ThemeToggle } from '../ui/ThemeToggle'
import { BrandMark } from './BrandMark'

export function AuthLayout({ variant, children }) {
  return (
    <div className={`auth-shell auth-${variant}`}>
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
