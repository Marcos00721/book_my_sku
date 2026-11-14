import { useState } from 'react'
import { useResource } from '../../hooks/useResource'
import { queryPath } from '../../services/workspace'
import { ErrorNotice } from '../workspace/Elements'
import { Pager } from '../workspace/RecordTools'
import {
  packagingDescription,
  variantName,
} from '../customProducts/variantHelpers'

/** Select current variants or retained variants for historical previews. */
export function PricingVariantSelect({
  path,
  label = 'Variant',
  value,
  change,
  required = false,
  excluded = [],
  showPackaging = false,
  retained,
  allowed,
}) {
  const [pages, setPages] = useState([])
  const resource = useResource(
    retained
      ? null
      : queryPath(`${path}/variants`, {
          status: 'selectable',
          limit: 50,
          after: pages.at(-1),
        }),
  )
  const items = retained || resource.data?.items || []

  return (
    <>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      <label className="field">
        <span>
          {label}
          {required ? (
            <span className="required-mark" aria-hidden="true">
              {' '}
              *
            </span>
          ) : null}
        </span>
        <select
          required={required}
          value={value || ''}
          disabled={resource.loading || Boolean(resource.error)}
          aria-label={label}
          onChange={(event) => change(event.target.value)}
        >
          <option value="">Choose a variant</option>
          {value &&
            (!allowed || allowed.includes(value)) &&
            !items.some((item) => item.id === value) && (
              <option value={value}>Selected variant: {value}</option>
            )}
          {items
            .filter(
              (variant) =>
                (!allowed || allowed.includes(variant.id)) &&
                (!excluded.includes(variant.id) || variant.id === value),
            )
            .map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.label || variantName(variant)}
              </option>
            ))}
        </select>
      </label>
      {showPackaging && items.some((item) => item.id === value) && (
        <p className="product-form-hint">
          {packagingDescription(items.find((item) => item.id === value)?.units)}
        </p>
      )}
      {(pages.length > 0 || resource.data?.next) && (
        <Pager
          resource={resource}
          pages={pages}
          setPages={setPages}
          label="variant choices"
        />
      )}
    </>
  )
}
