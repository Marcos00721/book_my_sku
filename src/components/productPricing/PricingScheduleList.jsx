import { Empty, ErrorNotice, ListSkeleton } from '../workspace/Elements'
import { Pager } from '../workspace/RecordTools'
import { PricingScheduleCard, PricingScheduleRow } from './PricingScheduleRow'
import { PricingSummary } from './PricingSummary'

export function PricingScheduleList({
  resource,
  pages,
  setPages,
  kind,
  editable,
  canPublish,
  onOpen,
  onPublish,
  canCreate,
}) {
  const items = resource.data?.items || []

  return (
    <div className="pricing-schedule-list">
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading && !resource.data ? (
        <>
          <div className="pricing-table-desktop">
            <ListSkeleton label="Loading pricing schedules…" columns={['Agreement / account / warehouse', 'Version', 'Effective interval', 'Actions']} rows={4} />
          </div>
          <div className="pricing-table-mobile">
            <ListSkeleton label="Loading pricing schedules…" variant="list" rows={4} />
          </div>
        </>
      ) : items.length ? (
        <>
          <div className="table-scroll pricing-table-desktop">
            <table className="data-table pricing-table">
              <thead>
                <tr>
                  <th scope="col">Agreement / account / warehouse</th>
                  <th scope="col">Version</th>
                  <th scope="col">Effective interval</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((schedule) => (
                  <PricingScheduleRow
                    key={schedule.id}
                    schedule={schedule}
                    kind={kind}
                    editable={editable}
                    canPublish={canPublish}
                    onOpen={onOpen}
                    onPublish={onPublish}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="pricing-table-mobile">
            {items.map((schedule) => (
              <PricingScheduleCard
                key={schedule.id}
                schedule={schedule}
                kind={kind}
                editable={editable}
                canPublish={canPublish}
                onOpen={onOpen}
                onPublish={onPublish}
              />
            ))}
          </div>
          <PricingSummary schedules={items} />
        </>
      ) : (
        !resource.error && (
          <Empty title="No pricing added yet">
            Add pricing for this product. You can add multiple quantity tiers in
            a draft schedule, then publish when ready.
            {canCreate
              ? ' Use Add pricing to create the first price list.'
              : ''}
          </Empty>
        )
      )}
      <Pager
        resource={resource}
        pages={pages}
        setPages={setPages}
        label="schedules"
      />
    </div>
  )
}
