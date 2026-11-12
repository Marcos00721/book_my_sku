import { ActivityTimeline } from '../../components/workspace/ActivityTimeline'

export function ClientActivity({ path }) {
  return (
    <ActivityTimeline
      path={`${path}/activity`}
      permission="clients.history.view"
      description="Recorded changes to this client, its contacts and addresses."
    />
  )
}
