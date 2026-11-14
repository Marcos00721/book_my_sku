import { useState } from 'react'
import { Dialog, Field, SaveFooter } from '../workspace/Elements'
import { useMutation } from '../../hooks/useMutation'
import { PackagingFields } from './PackagingFields'
import { VariantCorrectionReview } from './VariantCorrectionReview'
import {
  packagingPayload,
  packagingValues,
  variantName,
} from './variantHelpers'

export function VariantCorrectionDialog({
  path,
  product,
  variant,
  canAdopt,
  close,
  saved,
}) {
  const [partCode, setPartCode] = useState(variant.partCode || '')
  const [packaging, setPackaging] = useState(() =>
    packagingValues(variant.units),
  )
  const [packagingChanged, setPackagingChanged] = useState(false)
  const [selections, setSelections] = useState(
    structuredClone(variant.selections || []),
  )
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [adopt, setAdopt] = useState(false)
  const [revision, setRevision] = useState(product.revision)
  const mutation = useMutation()
  const codeChanged = partCode.trim() !== (variant.partCode || '')
  const labelsChanged =
    JSON.stringify(selections) !== JSON.stringify(variant.selections || [])
  async function submit(event) {
    event.preventDefault()
    const result = await mutation.run('post', `${path}/variants`, {
      expectedRevision: revision,
      changes: [
        {
          action: 'correct',
          variantId: variant.id,
          samePhysicalVariant: true,
          reason: reason.trim(),
          ...(codeChanged ? { partCode: partCode.trim() || null } : {}),
          ...(packagingChanged ? { units: packagingPayload(packaging) } : {}),
          ...(labelsChanged
            ? {
                selections: selections.map(
                  ({ dimensionId, valueId, dimensionLabel, valueLabel }) => ({
                    dimensionId,
                    valueId,
                    dimensionLabel,
                    valueLabel,
                  }),
                ),
              }
            : {}),
        },
      ],
    })
    if (result) saved(adopt)
  }
  return (
    <Dialog
      title="Correct variant details"
      description={variantName(variant)}
      close={close}
      locked={mutation.pending || mutation.uncertain}
      size="lg"
      className="product-form-dialog"
    >
      <form className="product-form" onSubmit={submit}>
        <div className="product-form-body">
          <fieldset
            disabled={mutation.pending || mutation.uncertain}
            className="product-form-fields"
          >
            <Field
              label="Supplier part code"
              maxLength={120}
              value={partCode}
              hint="Clear this field if the code is unknown."
              onChange={(event) => setPartCode(event.target.value)}
            />
            <PackagingFields
              values={packaging}
              change={(patch) => {
                setPackaging((current) => ({ ...current, ...patch }))
                setPackagingChanged(true)
              }}
            />
            {selections.length > 0 && (
              <details className="product-advanced">
                <summary>Correct option labels</summary>
                {selections.map((selection, index) => (
                  <div className="form-grid" key={selection.dimensionId}>
                    {['dimensionLabel', 'valueLabel'].map((key) => (
                      <Field
                        key={key}
                        label={`${key === 'dimensionLabel' ? 'Option' : 'Value'} label ${index + 1}`}
                        required
                        maxLength={80}
                        value={selection[key]}
                        onChange={(event) =>
                          setSelections((current) =>
                            current.map((row, i) =>
                              i === index
                                ? { ...row, [key]: event.target.value }
                                : row,
                            ),
                          )
                        }
                      />
                    ))}
                  </div>
                ))}
              </details>
            )}
            <Field
              label="Reason for correction"
              required
              maxLength={500}
              value={reason}
              placeholder="e.g. Supplier confirmed 12 items per box"
              onChange={(event) => setReason(event.target.value)}
            />
            <label className="check-label">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              This is the same physical item; I am correcting its details.
            </label>
            <p className="product-form-hint">
              A different physical item needs a new variant. This correction
              keeps the variant and its images together.
            </p>
            {canAdopt && (
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={adopt}
                  onChange={(event) => setAdopt(event.target.checked)}
                />
                Also apply these corrections to existing pricing
              </label>
            )}
            <p className="notice">
              Published prices keep their saved packaging.{' '}
              {canAdopt
                ? 'To use this correction in pricing, review the affected versions and create new drafts after saving.'
                : 'A pricing editor can review the correction and create updated pricing drafts.'}
            </p>
          </fieldset>
          <VariantCorrectionReview
            error={mutation.error}
            path={path}
            variantId={variant.id}
            values={{
              partCode,
              units: packagingChanged ? packagingPayload(packaging) : null,
              selections,
              codeChanged,
              packagingChanged,
              labelsChanged,
            }}
            onReview={(current) => {
              setRevision(current.revision)
              setConfirmed(false)
            }}
          />
        </div>
        <SaveFooter
          mutation={mutation}
          close={close}
          disabled={
            !confirmed ||
            !reason.trim() ||
            !(codeChanged || packagingChanged || labelsChanged)
          }
          label={adopt ? 'Save and review pricing' : 'Save correction'}
        />
      </form>
    </Dialog>
  )
}
