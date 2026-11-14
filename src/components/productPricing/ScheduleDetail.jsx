import { Action, Dialog, ErrorNotice, Loading } from '../workspace/Elements'
import { useResource } from '../../hooks/useResource'
import { ScheduleEditor } from './ScheduleEditor'
import { RateSummary } from './RateSummary'

export function ScheduleDetail({
  path,
  id,
  kind,
  cost,
  editable,
  close,
  saved,
  onHistoricalPreview,
}) {
  const resource = useResource(`${path}/pricing/schedules/${id}?kind=${kind}`)

  if (resource.loading || resource.error) {
    return (
      <Dialog
        title="Pricing schedule"
        close={close}
        className="product-form-dialog"
      >
        <div className="product-form-body">
          {resource.loading ? (
            <Loading />
          ) : (
            <ErrorNotice error={resource.error} retry={resource.reload} />
          )}
        </div>
      </Dialog>
    )
  }

  if (editable) {
    return (
      <ScheduleEditor
        path={path}
        schedule={resource.data}
        cost={cost}
        editable
        close={close}
        saved={saved}
      />
    )
  }

  const schedule = resource.data
  return (
    <Dialog
      title="Pricing schedule version"
      description="Read-only snapshot of this published or historical interval."
      close={close}
      size="lg"
      className="product-form-dialog"
    >
      <div className="product-form-body">
        <div className="product-form-lead">
          <p>
            {schedule.agreementId} · {schedule.accountId} ·{' '}
            {schedule.warehouseId}
          </p>
          <p>
            Version {schedule.id} · Revision {schedule.revision}
          </p>
          <p>
            Effective: {schedule.start || 'Draft'} –{' '}
            {schedule.end || 'Open-ended'}
          </p>
          {schedule.originalStart ? (
            <p>
              Original interval: {schedule.originalStart} –{' '}
              {schedule.originalEnd || 'Open-ended'} · Current interval revision{' '}
              {schedule.intervalRevision}
            </p>
          ) : null}
        </div>
        <RateSummary schedule={schedule} cost={cost} />
        {cost && schedule.unitSnapshot?.length > 0 && (
          <section className="product-form-section">
            <h3>Packaging saved with this version</h3>
            {schedule.unitSnapshot.map((unit, index) => (
              <p key={unit.id}>
                Variant {index + 1}: 1 {unit.procurementUnit || 'purchase unit'}{' '}
                = {unit.eachPerProcurementUnit ?? '?'} items
              </p>
            ))}
          </section>
        )}
        {kind === 'published' && onHistoricalPreview && (
          <Action
            variant="secondary"
            onClick={() => onHistoricalPreview(schedule)}
          >
            Preview saved version
          </Action>
        )}
      </div>
    </Dialog>
  )
}
