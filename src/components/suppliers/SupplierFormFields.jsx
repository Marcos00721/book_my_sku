import { Link } from 'react-router-dom'
import { useFormContext, useWatch } from 'react-hook-form'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useResource } from '../../hooks/useResource'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { queryPath } from '../../services/workspace'
import { supplierCapabilityOptions } from '../../schemas/supplierFormSchema'
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

  function toggle(value) {
    if (value === requiredCapability || locked) return
    const next = capabilities.includes(value)
      ? capabilities.filter((item) => item !== value)
      : [...capabilities, value]
    setValue('capabilities', next, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })
  }

  return (
    <fieldset className="supplier-form-capabilities">
      <legend>
        Business capabilities <span className="field-required">*</span>
      </legend>
      <p className="supplier-form-hint muted">
        Select every role this business plays for your team.
      </p>
      <div className="supplier-form-capability-grid">
        {supplierCapabilityOptions.map((option) => {
          const checked = capabilities.includes(option.value)
          const lockedOption = option.value === requiredCapability
          return (
            <label
              key={option.value}
              className={`supplier-capability-card${checked ? ' is-selected' : ''}${locked || lockedOption ? ' is-disabled' : ''}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={locked || lockedOption}
                onChange={() => toggle(option.value)}
              />
              <span className="supplier-capability-card-label">
                {option.label}
              </span>
            </label>
          )
        })}
      </div>
      {error?.message ? (
        <p className="field-error" role="alert">
          {error.message}
        </p>
      ) : null}
    </fieldset>
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
            hint="Your account with this supplier"
            maxLength={120}
            disabled={disabled}
          />
        </div>
        <SupplierDuplicateHints excludeId={excludeId} />
      </FormSection>

      <FormSection title="Capabilities">
        <CapabilityFields
          disabled={disabled}
          requiredCapability={requiredCapability}
        />
      </FormSection>

      <FormSection title="Contact details">
        <div className="form-grid">
          <FormTextField
            name="website"
            label="Website"
            hint="Include https://"
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
        </div>
        <div className="form-grid">
          <FormPhoneField
            name="phone"
            label="Phone"
            disabled={disabled}
          />
          <div className="supplier-form-field-note" aria-hidden="true">
            <p className="supplier-form-field-note-title">Tip</p>
            <p className="muted">
              Add the main line your team dials for orders and production.
            </p>
          </div>
        </div>
      </FormSection>
    </div>
  )
}
