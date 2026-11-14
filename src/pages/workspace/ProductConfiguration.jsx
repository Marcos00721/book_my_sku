import { useState } from 'react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useResource } from '../../hooks/useResource'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { queryPath } from '../../services/workspace'
import {
  Action,
  Empty,
  ErrorNotice,
  Field,
  ListSkeleton,
  Status,
} from '../../components/workspace/Elements'
import { Pager } from '../../components/workspace/RecordTools'
import { ConfigurationEditor } from '../../components/customProducts/ConfigurationEditor'
import { ColorSizeEditor } from '../../components/customProducts/ColorSizeEditor'
import { VariantEditor } from '../../components/customProducts/VariantEditor'
import { VariantCorrectionDialog } from '../../components/customProducts/VariantCorrectionDialog'
import { PricingAdoptionDialog } from '../../components/productPricing/PricingAdoptionDialog'
import {
  hasColorSizeOptions,
  packagingDescription,
  variantName,
} from '../../components/customProducts/variantHelpers'

export function ProductConfiguration({ path, product, changed }) {
  const workspace = useWorkspace()
  const [status, setStatus] = useState('selectable')
  const [partCode, setPartCode] = useState('')
  const search = useDebouncedValue(partCode.trim(), 350)
  const [pages, setPages] = useState([])
  const [editor, setEditor] = useState(null)
  const [flash, setFlash] = useState('')
  const variants = useResource(
    queryPath(`${path}/variants`, {
      status,
      partCode: search,
      limit: 25,
      after: pages.at(-1),
    }),
  )
  const editable =
    workspace.can('products.edit') &&
    workspace.writesAllowed &&
    product.status !== 'archived'
  const canAdopt =
    workspace.can('products.pricing.edit') &&
    workspace.can('products.pricing.cost') &&
    workspace.can('products.pricing.preview') &&
    workspace.writesAllowed &&
    product.status !== 'archived'
  const configuration = product.configuration || {
    mode: 'unresolved',
    dimensions: [],
  }
  const configured = configuration.mode !== 'unresolved'
  const simpleOptions = hasColorSizeOptions(configuration)
  const isDraft = product.status === 'draft'
  function saved(message, adoption = false) {
    setEditor(adoption ? { type: 'adoption' } : null)
    variants.reload()
    changed()
    setFlash(message)
  }
  return (
    <div className="product-variants">
      <div className="section-heading">
        <div>
          <h2>Variants</h2>
          <p className="product-pricing-lead">
            Add colors and sizes, then choose the combinations you sell.
          </p>
        </div>
        {editable && isDraft && (
          <div className="actions">
            <Action
              variant="secondary"
              onClick={() => setEditor({ type: 'configuration' })}
            >
              {simpleOptions
                ? configured
                  ? 'Edit colors & sizes'
                  : 'Add colors & sizes'
                : 'Edit options'}
            </Action>
            {configured && (
              <Action onClick={() => setEditor({ type: 'variants' })}>
                {product.selectableVariantCount > 0
                  ? 'Manage variants'
                  : 'Add variants'}
              </Action>
            )}
          </div>
        )}
      </div>
      {configuration.dimensions.length > 0 && (
        <div className="color-size-summary">
          {configuration.dimensions.map((dimension) => (
            <div key={dimension.id}>
              <strong>
                {/^(color|colour)$/i.test(dimension.label)
                  ? 'Color'
                  : dimension.label}
              </strong>
              <ul
                className="color-size-values"
                aria-label={`Saved ${dimension.label.toLowerCase()} options`}
              >
                {dimension.values.map((value) => (
                  <li key={value.id}>{value.label}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {flash && (
        <p className="notice" role="status">
          {flash}
        </p>
      )}
      {configuration.customIdentification && (
        <p className="product-form-hint">
          Reviewed item: {configuration.customIdentification}
        </p>
      )}
      {product.status === 'active' && (
        <p className="notice">
          Use Correct details to fix a part code, label or packaging on this
          active product. To add or retire variants, archive the product and
          restore it as a draft.
        </p>
      )}
      <div className="form-grid variant-filters">
        <Field
          label="Find by exact part code"
          placeholder="Enter supplier part code"
          maxLength={120}
          value={partCode}
          onChange={(event) => {
            setPartCode(event.target.value)
            setPages([])
          }}
        />
        <Field
          label="Variant status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value)
            setPages([])
          }}
        >
          <option value="selectable">Available</option>
          <option value="archived">Retired</option>
          <option value="all">All variants</option>
        </Field>
      </div>
      <ErrorNotice error={variants.error} retry={variants.reload} />
      {variants.loading ? (
        <ListSkeleton
          label="Loading variants…"
          columns={[
            'Variant',
            'Packaging',
            'Status',
            ...(editable ? ['Actions'] : []),
          ]}
        />
      ) : variants.data?.items?.length ? (
        <div className="table-scroll">
          <table className="data-table variant-table">
            <thead>
              <tr>
                <th scope="col">Variant</th>
                <th scope="col">Packaging</th>
                <th scope="col">Status</th>
                {editable && <th scope="col">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {variants.data.items.map((variant) => (
                <tr key={variant.id}>
                  <th scope="row">{variantName(variant)}</th>
                  <td>
                    {packagingDescription(variant.units)}
                    {variant.units?.procurementMinimum != null && (
                      <small>
                        Minimum {variant.units.procurementMinimum} purchase
                        units
                      </small>
                    )}
                    {variant.units?.procurementMultiple != null && (
                      <small>
                        Order in multiples of{' '}
                        {variant.units.procurementMultiple}
                      </small>
                    )}
                  </td>
                  <td>
                    <Status
                      value={
                        variant.status === 'selectable'
                          ? 'available'
                          : 'retired'
                      }
                    />
                  </td>
                  {editable && (
                    <td>
                      {variant.status === 'selectable' && (
                        <Action
                          variant="secondary"
                          onClick={() =>
                            setEditor({ type: 'correction', variant })
                          }
                        >
                          Correct details
                          <span className="sr-only">
                            {' '}
                            for {variantName(variant)}
                          </span>
                        </Action>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !variants.error && (
          <Empty title={search ? 'No matching part code' : 'No variants yet'}>
            {search
              ? 'Check the exact spelling or clear the part code to see all variants.'
              : configured
                ? 'Use Add variants to choose a color and size. Packaging can be added later.'
                : 'Use Add colors & sizes to enter your choices. Leave both empty if this product has no options.'}
          </Empty>
        )
      )}
      {(pages.length > 0 || variants.data?.next) && (
        <Pager
          resource={variants}
          pages={pages}
          setPages={setPages}
          label="variants"
        />
      )}
      {editor?.type === 'configuration' &&
        (simpleOptions ? (
          <ColorSizeEditor
            path={path}
            product={product}
            close={() => setEditor(null)}
            saved={() =>
              saved(
                'Colors and sizes saved. Use Add variants to choose the combinations you sell.',
              )
            }
          />
        ) : (
          <ConfigurationEditor
            path={path}
            product={product}
            close={() => setEditor(null)}
            saved={() =>
              saved('Options saved. Next, add the variants you supply.')
            }
          />
        ))}
      {editor?.type === 'variants' && (
        <VariantEditor
          path={path}
          product={product}
          close={() => setEditor(null)}
          saved={() =>
            saved(
              'Variants saved. You can now set their prices in the Pricing tab.',
            )
          }
        />
      )}
      {editor?.type === 'correction' && (
        <VariantCorrectionDialog
          path={path}
          product={product}
          variant={editor.variant}
          canAdopt={canAdopt}
          close={() => setEditor(null)}
          saved={(adopt) => saved('Variant correction saved.', adopt)}
        />
      )}
      {editor?.type === 'adoption' && (
        <PricingAdoptionDialog path={path} close={() => setEditor(null)} />
      )}
    </div>
  )
}
