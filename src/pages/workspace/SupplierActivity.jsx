import { ActivityTimeline } from '../../components/workspace/ActivityTimeline'

export function SupplierActivity({ path }) {
  return (
    <ActivityTimeline
      path={`${path}/activity`}
      permission="suppliers.history.view"
      description="Recorded changes to this supplier, its contacts and addresses."
    />
  )
}
