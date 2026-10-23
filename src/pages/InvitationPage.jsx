import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuthSession } from '../hooks/useAuthSession'
import { useMutation } from '../hooks/useMutation'
import { captureInvitation, clearInvitation } from '../services/invitation'
import { getAuthClient } from '../services/auth'
import { BrandMark } from '../components/auth/BrandMark'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import {
  Action,
  Empty,
  ErrorNotice,
  Loading,
  PageHeader,
} from '../components/workspace/Elements'
import { LoginPage } from './LoginPage'

export function InvitationPage() {
  const [invitation] = useState(captureInvitation)
  const [accepted, setAccepted] = useState(false)
  const auth = useAuthSession()
  const mutation = useMutation()
  if (!invitation)
    return (
      <div className="setup-layout">
        <Empty
          title="Open your latest invitation email"
          action={
            <Link className="button" to="/login">
              Back to sign in
            </Link>
          }
        >
          This invitation is missing or has already been handled. Ask the
          workspace owner to resend it if needed.
        </Empty>
      </div>
    )
  if (auth.loading) return <Loading />
  if (!auth.session) return <LoginPage returnTo="/team/accept" />
  if (accepted) return <Navigate to="/app" replace />
  return (
    <div className="setup-layout">
      <header className="setup-top">
        <BrandMark />
        <ThemeToggle />
      </header>
      <PageHeader
        title="There’s a place for you here."
        eyebrow="TEAM INVITATION"
        description="Join your team using the verified email that received this invitation."
      />
      <section className="panel">
        <p>
          Signed in as <strong>{auth.session.user.email}</strong>.
        </p>
        <p className="muted">
          Your invitation uses an already reserved seat. Joining does not create
          an owner subscription.
        </p>
        <ErrorNotice error={mutation.error || auth.error} />
        <div className="actions">
          <Action
            disabled={!auth.session.user.email_confirmed_at || mutation.pending}
            onClick={async () => {
              const result = await mutation.run(
                'post',
                `/organizations/${invitation.organizationId}/invitations/${invitation.invitationId}/accept`,
                { token: invitation.token },
                { idempotent: false },
              )
              if (result) {
                clearInvitation()
                setAccepted(true)
              }
            }}
          >
            {mutation.pending ? 'Joining…' : 'Accept invitation'}
          </Action>
          <Action
            variant="secondary"
            onClick={() => getAuthClient().auth.signOut()}
          >
            Use another account
          </Action>
        </div>
        {!auth.session.user.email_confirmed_at && (
          <p className="notice">Confirm your sign-in email before accepting.</p>
        )}
      </section>
    </div>
  )
}
