import { useWatch } from 'react-hook-form'
import { useResource } from '../../hooks/useResource'
import { customProductPaths } from '../../services/customProductApi'
import { queryPath } from '../../services/workspace'
import { FormSelectField } from '../forms/FormSelectField'
import { FormTextEditor } from '../forms/FormTextEditor'
import { FormTextField } from '../forms/FormTextField'
import { Action, ErrorNotice, Loading } from '../workspace/Elements'

function ProductFormSection({ title, children }) {
  return (
    <section className="custom-product-form-section">
      <h3 className="custom-product-form-section-title">{title}</h3>
      <div className="custom-product-form-section-body">{children}</div>
    </section>
  )
}

/** Async options via shared FormSelectField (same chrome as Client forms). */
function OptionsSelect({
  name,
  path,
  label,
  required = false,
  disabled = false,
  selectedLabel,
  hint,
}) {
  const resource = useResource(queryPath(path, { limit: 50 }))
  const items = resource.data?.items || []
  const selectedValue = useWatch({ name }) || ''

  return (
    <div className="min-w-0">
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading && !items.length ? (
        <Loading variant="field" label={`Loading ${label.toLowerCase()}…`} />
      ) : (
        <FormSelectField
          name={name}
          label={label}
          required={required}
          hint={hint}
          disabled={disabled || Boolean(resource.error)}
        >
          <option value="">
            {required ? 'Choose an option' : 'Not set'}
          </option>
          {selectedValue &&
            !items.some(
              (item) =>
                String(item.id || item._id) === String(selectedValue),
            ) && (
              <option value={selectedValue}>
                {selectedLabel || 'Current selection'} (saved)
              </option>
            )}
          {items.map((item) => (
            <option key={item.id || item._id} value={item.id || item._id}>
              {item.label || item.name}
            </option>
          ))}
        </FormSelectField>
      )}
    </div>
  )
}

/** Shared add/edit fields — must render inside AppFormProvider. */
export function CustomProductFormFields({
  productsBase,
  product = null,
  disabled = false,
  autoFocusName = false,
  supplierSelectedLabel,
  categorySelectedLabel,
  onAddSupplier,
  imageField,
}) {
  const isEdit = Boolean(product)

  return (
    <div className="custom-product-form-fields">
      <div className="custom-product-form-overview">
        <ProductFormSection title="Product details">
          <div className="custom-product-form-grid">
            <FormTextField
              name="name"
              label="Product name"
              required
              maxLength={160}
              autoFocus={autoFocusName}
              disabled={disabled}
              placeholder="e.g. Classic polo"
            />
            {isEdit ? (
              <p className="custom-product-form-lead">
                Supplier: {product.supplier?.name || 'Supplier unavailable'}. To
                change supplier, copy this draft.
              </p>
            ) : (
              <div className="custom-product-form-supplier">
                <OptionsSelect
                  name="supplierId"
                  path={customProductPaths.supplierOptions(productsBase)}
                  label="Supplier"
                  required
                  disabled={disabled}
                  selectedLabel={supplierSelectedLabel}
                />
                {onAddSupplier ? (
                  <Action
                    type="button"
                    variant="text-button"
                    disabled={disabled}
                    onClick={onAddSupplier}
                    className="custom-product-form-add-supplier"
                  >
                    Add supplier
                  </Action>
                ) : null}
              </div>
            )}
            <FormTextField
              name="supplierItemCode"
              label="Supplier item code"
              hint="Leading zeros and capitalization are preserved. Used codes stay reserved."
              maxLength={120}
              disabled={disabled}
              placeholder="e.g. 001-Ab"
            />
            <OptionsSelect
              name="categoryId"
              path={customProductPaths.categoryOptions(productsBase)}
              label="Product category"
              disabled={disabled}
              selectedLabel={categorySelectedLabel}
            />
          </div>
        </ProductFormSection>
        {imageField}
      </div>

      <ProductFormSection title="Notes (optional)">
        <div className="custom-product-form-grid custom-product-form-notes">
          <FormTextEditor
            name="description"
            label="Description"
            maxLength={4000}
            disabled={disabled}
            rows={4}
            placeholder="Short public-facing description"
          />
          <FormTextEditor
            name="privateNotes"
            label="Private notes"
            hint="Internal only — never shown to customers. Supports basic formatting."
            maxLength={4000}
            disabled={disabled}
            rows={4}
            placeholder="Internal notes for your team"
          />
        </div>
      </ProductFormSection>
    </div>
  )
}
