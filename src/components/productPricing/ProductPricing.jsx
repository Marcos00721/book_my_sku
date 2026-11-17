import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useResource } from '../../hooks/useResource'
import { queryPath } from '../../services/workspace'
import { Empty, Field } from '../workspace/Elements'
import { Button } from '../common/Button'
import { PricingScheduleList } from './PricingScheduleList'
import { ScheduleEditor } from './ScheduleEditor'
import { ScheduleDetail } from './ScheduleDetail'
import { PublicationDialog } from './PublicationDialog'
import { GoodsPreview } from './GoodsPreview'
import { PricingAdoptionDialog } from './PricingAdoptionDialog'
import { PriceTableEditor } from './PriceTableEditor'

export function ProductPricing({ path, product }) {
  const workspace = useWorkspace()
  const rights = ['edit', 'publish', 'preview', 'cost'].map((action) =>
    workspace.can(`products.pricing.${action}`),
  )
  if (!rights.slice(0, 3).some(Boolean)) {
    return (
      <Empty title="Pricing access is limited">
        Ask your workspace owner for pricing access.
      </Empty>
    )
  }
  return (
    <PriceTableEditor
      key={`${path}:${rights.join(':')}:${workspace.writesAllowed}`}
      path={path}
      product={product}
      edit={rights[0]}
      preview={rights[2]}
      cost={rights[3]}
      legacy={
        <PricingWorkspace
          path={path}
          product={product}
          edit={rights[0]}
          publish={rights[1]}
          preview={rights[2]}
          cost={rights[3]}
        />
      }
    />
  )
}

function PricingWorkspace({ path, product, edit, publish, preview, cost }) {
  const workspace = useWorkspace()
  const [kind, setKind] = useState(edit || publish ? 'draft' : 'published')
  const [pages, setPages] = useState([])
  const [selected, setSelected] = useState(null)
  const [creating, setCreating] = useState(false)
  const [publishing, setPublishing] = useState(null)
  const [tab, setTab] = useState('schedules')
  const [flash, setFlash] = useState('')
  const [adopting, setAdopting] = useState(false)
  const [historical, setHistorical] = useState(null)
  const resource = useResource(
    queryPath(`${path}/pricing/schedules`, {
      kind,
      limit: 25,
      after: pages.at(-1),
    }),
  )
  const writable = workspace.writesAllowed && product.status !== 'archived'
  const canCreate =
    edit && cost && writable && product.selectableVariantCount > 0

  useEffect(() => {
    if (!flash) return
    const timer = setTimeout(() => setFlash(''), 4000)
    return () => clearTimeout(timer)
  }, [flash])

  function changed(message) {
    setSelected(null)
    setCreating(false)
    setPublishing(null)
    resource.reload()
    if (message) setFlash(message)
  }

  return (
    <div className="product-pricing">
      <div className="section-heading">
        <div>
          <h2>Pricing</h2>
          <p className="product-pricing-lead">
            Enter supplier costs and selling prices, save a draft, then publish
            when ready. All prices are in USD. Freight, tax and decoration are
            separate.
          </p>
        </div>
        {canCreate && tab === 'schedules' && (
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden="true" />
            Add pricing
          </Button>
        )}
      </div>

      {flash ? (
        <p className="client-flash notice" role="status" aria-live="polite">
          {flash}
        </p>
      ) : null}
      {!product.selectableVariantCount && product.status !== 'archived' && (
        <p className="notice">
          Add a variant in the Variants tab before creating pricing.
        </p>
      )}

      <div className="tabs" role="tablist" aria-label="Pricing views">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'schedules'}
          onClick={() => setTab('schedules')}
        >
          Price lists
        </button>
        {preview && (
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'preview'}
            onClick={() => {
              setHistorical(null)
              setTab('preview')
            }}
          >
            Preview prices
          </button>
        )}
      </div>

      {tab === 'preview' ? (
        <GoodsPreview
          key={historical?.id || 'current'}
          path={path}
          cost={cost}
          historical={historical}
        />
      ) : (
        <>
          <Field
            label="Pricing schedule view"
            value={kind}
            onChange={(event) => {
              setKind(event.target.value)
              setPages([])
            }}
          >
            {(edit || publish) && (
              <option value="draft">Draft schedules</option>
            )}
            {preview && <option value="published">Published versions</option>}
          </Field>
          {edit && cost && preview && writable && kind === 'published' && (
            <div className="pricing-row-actions">
              <Button variant="secondary" onClick={() => setAdopting(true)}>
                Review packaging corrections
              </Button>
            </div>
          )}
          <PricingScheduleList
            resource={resource}
            pages={pages}
            setPages={setPages}
            kind={kind}
            editable={edit && writable}
            canPublish={publish && cost && writable}
            onOpen={setSelected}
            onPublish={setPublishing}
            canCreate={canCreate}
          />
        </>
      )}

      {creating && (
        <ScheduleEditor
          path={path}
          cost={cost}
          editable={edit && writable}
          close={() => setCreating(false)}
          saved={() => changed('Pricing draft saved.')}
        />
      )}
      {selected && (
        <ScheduleDetail
          path={path}
          id={selected}
          kind={kind}
          cost={cost}
          editable={edit && writable && kind === 'draft'}
          close={() => setSelected(null)}
          saved={() => changed('Pricing draft updated.')}
          onHistoricalPreview={
            preview
              ? (schedule) => {
                  setSelected(null)
                  setHistorical(schedule)
                  setTab('preview')
                }
              : undefined
          }
        />
      )}
      {publishing && (
        <PublicationDialog
          path={path}
          id={publishing}
          canBrowsePublished={preview}
          close={() => setPublishing(null)}
          saved={() => changed('Pricing schedule published.')}
        />
      )}
      {adopting && (
        <PricingAdoptionDialog
          path={path}
          close={() => {
            setAdopting(false)
            resource.reload()
          }}
          saved={() => resource.reload()}
        />
      )}
    </div>
  )
}
