import { ArrowLeft, KeyRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../components/auth/AuthLayout'
import { AuthPageContent } from '../components/auth/AuthPageContent'

export function AccountHelpPage() {
  return (
    <AuthLayout variant="login">
      <AuthPageContent
        id="account-help-title"
        eyebrow="A little help getting back"
        title="Forgot your password?"
        description="Your organization’s administrator can help you recover access to your workspace."
      >
        <div className="flex items-start gap-md rounded-card border border-border-subtle bg-surface-muted p-lg">
          <KeyRound aria-hidden="true" className="mt-micro h-icon w-icon shrink-0 text-primary" />
          <p className="text-sm leading-relaxed text-text-muted">
            Contact your administrator using your organization’s usual support channel. Have the email address you use for BookMySku ready.
          </p>
        </div>
        <Link to="/login" className="app-link mt-lg inline-flex min-h-touch items-center gap-xs text-sm">
          <ArrowLeft aria-hidden="true" className="h-icon-sm w-icon-sm" /> Back to sign in
        </Link>
      </AuthPageContent>
    </AuthLayout>
  )
}
