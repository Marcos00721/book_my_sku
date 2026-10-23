import { Link, Navigate } from 'react-router-dom'
import { useResource } from '../hooks/useResource'
import { ErrorNotice, Loading, PageHeader } from '../components/workspace/Elements'
import { hasPendingInvitation } from '../services/invitation'

const registerActions = new Set(['verify_email','choose_onboarding','resume_registration','submit_application','correct_application','await_review','await_offer'])
const setupActions = new Set(['complete_company','prepare_workspace','review_offer','refresh_billing','wait_billing','wait_provisioning','review_and_start','recover_payment','activate_workspace'])

export function ContinuePage() {
  const journey = useResource('/onboarding/journey')
  if (journey.loading) return <Loading label="Checking your BookMySku journey…" />
  if (journey.error) return <div className="setup-layout"><ErrorNotice error={journey.error} retry={journey.reload} /></div>
  const action = journey.data.nextAction
  const hasServerInvitations = (journey.data.invitations?.items?.length || 0) > 0
  if (hasPendingInvitation()) return <Navigate to="/team/accept" replace />
  if (hasServerInvitations) return <div className="setup-layout"><PageHeader eyebrow="TEAM INVITATION" title="You have a pending team invitation." description="Open the latest invitation link sent to your email to accept it. BookMySku will not create another company application for a team invite." /><section className="panel"><p className="muted">Your workspaces remain available while the invitation is pending.</p><div className="actions"><Link className="button" to="/app">Open a workspace</Link><Link className="button secondary" to="/login">Sign in with the invited email</Link></div></section></div>
  if (action === 'open_workspace' || action === 'choose_workspace' || action === 'contact_owner') return <Navigate to="/app" replace />
  if (action === 'accept_assisted_invitation') return <Navigate to="/assisted/accept" replace />
  if (action === 'prepare_assisted_workspace') return <Navigate to="/assisted" replace />
  if (registerActions.has(action)) return <Navigate to="/register" replace />
  if (setupActions.has(action)) return <Navigate to="/setup" replace />
  return <div className="setup-layout"><PageHeader eyebrow="YOUR NEXT STEP" title="Let’s continue." description="BookMySku checked your account and found the next available step." /><section className="panel"><p className="muted">Next step: {String(action || 'choose_onboarding').replaceAll('_',' ')}.</p><div className="actions"><Link className="button" to={action === 'resume_invitation' ? '/team/accept' : '/register'}>{action === 'resume_invitation' ? 'Open invitation' : 'Continue registration'}</Link><Link className="button secondary" to="/app">Choose a workspace</Link></div></section></div>
}
