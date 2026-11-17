import { useWorkspace } from '../../hooks/WorkspaceContext'
import { StickyPageChrome } from '../../components/common'
import { PermissionDenied } from '../../components/workspace/Elements'
import { SageIntegration } from '../../components/settings/SageIntegration'

export function SettingsPage() {
  const workspace = useWorkspace()
  if (!workspace.owner) return <PermissionDenied />
  return (
    <StickyPageChrome
      title="Settings"
      description="Manage integrations for your workspace."
      tabs={{ label: 'Settings sections', items: [{ value: 'integrations', label: 'Integrations' }], value: 'integrations' }}
    >
      <SageIntegration />
    </StickyPageChrome>
  )
}
