import { useState } from 'react'
import { useResource } from '../../hooks/useResource'
import { queryPath } from '../../services/workspace'
import { ErrorNotice, Field } from './Elements'
import { Pager } from './RecordTools'

export function VariantSelect({
  path,
  label = 'Variant',
  value,
  change,
  required = false,
}) {
  const [pages, setPages] = useState([])
  const resource = useResource(
    queryPath(`${path}/variants`, {
      status: 'selectable',
      limit: 50,
      after: pages.at(-1),
    }),
  )
  const items = resource.data?.items || []
  return (
    <>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      <Field
        label={label}
        required={required}
        value={value || ''}
        disabled={resource.loading || Boolean(resource.error)}
        onChange={(event) => change(event.target.value)}
      >
        <option value="">
          {required ? 'Choose a variant' : 'Product primary image'}
        </option>
        {value && !items.some((item) => item.id === value) && (
          <option value={value}>Selected variant: {value}</option>
        )}
        {items.map((variant) => (
          <option key={variant.id} value={variant.id}>
            {variant.partCode ||
              variant.selections
                ?.map((selection) => selection.valueLabel)
                .join(' / ') ||
              'Default specification'}{' '}
            · {variant.id}
          </option>
        ))}
      </Field>
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
