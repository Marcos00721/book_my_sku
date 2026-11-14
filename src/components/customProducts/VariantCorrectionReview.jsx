import { useEffect, useState } from 'react'
import { Action, ErrorNotice, Loading } from '../workspace/Elements'
import { getCustomProductVariant } from '../../services/customProductApi'
import { readData } from '../../services/workspace'
import { packagingDescription } from './variantHelpers'

export function VariantCorrectionReview({
  error,
  path,
  variantId,
  values,
  onReview,
}) {
  const [reviewed, setReviewed] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState(null)
  const active = error?.code === 'VERSION_CONFLICT' && error !== reviewed
  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    Promise.all([
      readData(path, { signal: controller.signal }),
      getCustomProductVariant(path, variantId, controller.signal),
    ])
      .then(([product, variant]) => {
        if (!controller.signal.aborted)
          setState({ request: error, attempt, product, variant })
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setState({ request: error, attempt, error: failure })
      })
    return () => controller.abort()
  }, [active, error, path, variantId, attempt])
  if (!active) return null
  const current =
    state?.request === error && state?.attempt === attempt ? state : null
  const names = (selections) =>
    selections
      ?.map(
        (selection) => `${selection.dimensionLabel}: ${selection.valueLabel}`,
      )
      .join(', ') || 'Standard variant'
  return (
    <section className="notice" aria-label="Review conflicting changes">
      <h3>This variant changed while you were editing</h3>
      <p>
        Your edits are preserved. Review the latest variant details before
        saving again.
      </p>
      {!current ? (
        <Loading label="Loading current variant details…" />
      ) : current.error ? (
        <ErrorNotice
          error={current.error}
          retry={() => setAttempt((value) => value + 1)}
        />
      ) : !current.variant || current.variant.status !== 'selectable' ? (
        <p>
          This variant is no longer available for correction. Close this form
          and review the variant list.
        </p>
      ) : (
        <>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Detail</th>
                  <th scope="col">Current</th>
                  <th scope="col">Your changes</th>
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    'Supplier part code',
                    current.variant.partCode || 'Unknown',
                    values.codeChanged
                      ? values.partCode.trim() || 'Unknown'
                      : 'Keep current value',
                  ],
                  [
                    'Packaging',
                    packagingDescription(current.variant.units),
                    values.packagingChanged
                      ? packagingDescription(values.units)
                      : 'Keep current value',
                  ],
                  [
                    'Item label',
                    current.variant.units?.salesUnit || 'Unknown',
                    values.packagingChanged
                      ? values.units?.salesUnit || 'Unknown'
                      : 'Keep current value',
                  ],
                  [
                    'Minimum purchase units',
                    current.variant.units?.procurementMinimum ?? 'Unknown',
                    values.packagingChanged
                      ? (values.units?.procurementMinimum ?? 'Unknown')
                      : 'Keep current value',
                  ],
                  [
                    'Purchase multiple',
                    current.variant.units?.procurementMultiple ?? 'Unknown',
                    values.packagingChanged
                      ? (values.units?.procurementMultiple ?? 'Unknown')
                      : 'Keep current value',
                  ],
                  [
                    'Options',
                    names(current.variant.selections),
                    values.labelsChanged
                      ? names(values.selections)
                      : 'Keep current values',
                  ],
                ].map(([label, before, after]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    <td>{before}</td>
                    <td>{after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Action
            variant="secondary"
            onClick={() => {
              onReview(current.product)
              setReviewed(error)
            }}
          >
            Use current revision and keep my edits
          </Action>
        </>
      )}
    </section>
  )
}
