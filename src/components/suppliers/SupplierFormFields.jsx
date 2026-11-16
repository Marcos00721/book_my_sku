import { Link } from 'react-router-dom'
import { useFormContext, useWatch } from 'react-hook-form'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useResource } from '../../hooks/useResource'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { queryPath } from '../../services/workspace'
import { supplierCapabilityOptions } from '../../schemas/supplierFormSchema'
import { SelectField } from '../common/SelectField'
import { FormPhoneField } from '../forms/FormPhoneField'
import { FormTextField } from '../forms/FormTextField'

function SupplierDuplicateHints({ excludeId }) {
  const workspace = useWorkspace()
  const name = useWatch({ name: 'name' }) || ''
  const trimmed = name.trim()
  const debouncedName = useDebouncedValue(trimmed, 400)
  const waiting = Boolean(trimmed) && trimmed !== debouncedName
  const resource = useResource(
    debouncedName
      ? queryPath(`${workspace.base}/suppliers/duplicate-candidates`, {
          name: debouncedName,
          ...(excludeId ? { excludeId } : {}),
        })
      : null,
  )
  const matches = resource.data?.items || []
  if (!trimmed) return null
  if (waiting || resource.loading) {
    return (
      <p className="supplier-form-hint muted">Checking for similar suppliers…</p>
    )
  }
  if (resource.error) {
    return (
      <p className="supplier-form-hint muted">
        Could not check for duplicates. You can still save.
      </p>
    )
  }
  if (!matches.length) return null
  return (
    <aside className="supplier-form-duplicates" aria-label="Possible duplicates">
      <p className="supplier-form-duplicates-title">Similar suppliers found</p>
      <ul>
        {matches.map((item) => {
          const id = item.id || item._id
          const label = [item.name, item.supplierCode]
            .filter(Boolean)
            .join(' · ')
          return (
            <li key={id}>
              <Link className="app-link" to={`/app/suppliers/${id}`}>
                {label || 'Open supplier'}
              </Link>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}

function CapabilityFields({ disabled = false, requiredCapability }) {
  const {
    setValue,
    formState: { errors, isSubmitting },
  } = useFormContext()
  const capabilities = useWatch({ name: 'capabilities' }) || []
  const locked = disabled || isSubmitting
  const error = errors.capabilities

  function change(next) {
    if (locked || (requiredCapability && !next.includes(requiredCapability))) return
    setValue('capabilities', next, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })
  }

  return (
    <SelectField
      name="capabilities"
      label="Business capabilities"
      required
      multiple
      value={capabilities}
      options={supplierCapabilityOptions.map((option) => ({
        ...option,
        disabled: option.value === requiredCapability,
      }))}
      placeholder="Select capabilities"
      searchPlaceholder="Search capabilities"
      error={error?.message}
      disabled={locked}
      onChange={(event) => change(event.target.value)}
    />
  )
}

function FormSection({ title, children }) {
  return (
    <section className="supplier-form-section">
      <h3 className="supplier-form-section-title">{title}</h3>
      <div className="supplier-form-section-body">{children}</div>
    </section>
  )
}

/** Shared add/edit fields — must render inside AppFormProvider / FormProvider. */
export function SupplierFormFields({
  disabled = false,
  autoFocusName = false,
  excludeId,
  requiredCapability,
}) {
  return (
    <div className="supplier-form-fields">
      <FormSection title="Business details">
        <div className="form-grid">
          <FormTextField
            name="name"
            label="Business name"
            required
            maxLength={160}
            autoFocus={autoFocusName}
            disabled={disabled}
          />
          <FormTextField
            name="accountNumber"
            label="Account number"
            maxLength={120}
            disabled={disabled}
          />
        </div>
        <SupplierDuplicateHints excludeId={excludeId} />
      </FormSection>

      <CapabilityFields
        disabled={disabled}
        requiredCapability={requiredCapability}
      />

      <FormSection title="Contact details">
        <div className="form-grid supplier-contact-grid">
          <FormTextField
            name="website"
            label="Website"
            type="url"
            maxLength={300}
            disabled={disabled}
            placeholder="https://"
          />
          <FormTextField
            name="email"
            label="General email"
            type="email"
            maxLength={254}
            disabled={disabled}
            placeholder="orders@example.com"
          />
          <FormPhoneField
            name="phone"
            label="Phone"
            disabled={disabled}
          />
        </div>
      </FormSection>
    </div>
  )
}
