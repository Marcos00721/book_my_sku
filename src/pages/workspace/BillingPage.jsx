import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useResource } from '../../hooks/useResource'
import { BillingPanel } from '../../components/workspace/BillingPanel'
import {
  Empty,
  ErrorNotice,
  Loading,
  PageHeader,
  PermissionDenied,
} from '../../components/workspace/Elements'

export function BillingPage() {
  const workspace = useWorkspace()
  const status = useResource(workspace.owner ? '/onboarding/me' : null)
  if (!workspace.owner) return <PermissionDenied />
  return (
    <>
      <PageHeader
        title="Billing"
        description="Your agreed plan, payment status, and a little peace of mind."
      />
      {status.loading ? (
        <Loading />
      ) : status.error ? (
        <ErrorNotice error={status.error} retry={status.reload} />
      ) : status.data?.application?.id ? (
        <BillingPanel
          applicationId={status.data.application.id}
          changed={workspace.refreshAccess}
        />
      ) : (
        <Empty title="Billing needs a review">
          Contact support to connect this workspace to its billing account.
        </Empty>
      )}
    </>
  )
}
