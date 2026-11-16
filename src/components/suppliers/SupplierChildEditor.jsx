import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { useFormContext, useWatch } from 'react-hook-form'
import { useMutation } from '../../hooks/useMutation'
import { useResource } from '../../hooks/useResource'
import {
  supplierAddressFormSchema,
  supplierAddressToFormValues,
  supplierContactFormSchema,
  supplierContactRestoreSchema,
  supplierContactToFormValues,
} from '../../schemas/supplierChildFormSchemas'
import { SelectField } from '../common/SelectField'
import { Tooltip } from '../common/Tooltip'
import { AppFormProvider } from '../forms/AppFormProvider'
import { FormPhoneField } from '../forms/FormPhoneField'
import { FormTextField } from '../forms/FormTextField'
import { useAppForm } from '../forms/useAppForm'
import { ConflictReview } from '../workspace/RecordTools'
import { GeographyFields } from '../workspace/GeographyFields'
import {
  Dialog,
  ErrorNotice,
  SaveFooter,
} from '../workspace/Elements'
import {
  addressPurposes,
  contactPurposes,
  purposeLabel,
} from './supplierPurposes'

function FormSection({ title, children }) {
  return (
    <section className="supplier-form-section">
      <h3 className="supplier-form-section-title">{title}</h3>
      <div className="supplier-form-section-body">{children}</div>
    </section>
  )
}

function PurposeFields({
  name = 'purposes',
  options,
  legend,
  disabled = false,
  required = false,
  placeholder = 'Select responsibilities',
  searchPlaceholder = 'Search responsibilities',
}) {
  const {
    setValue,
    formState: { errors, isSubmitting },
  } = useFormContext()
  const selected = useWatch({ name }) || []
  const locked = disabled || isSubmitting
  const error = errors[name]

  function change(next) {
    if (locked) return
    setValue(name, next, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })
  }

  return (
    <SelectField
      name={name}
      label={legend}
      required={required}
      error={error?.message}
      multiple
      value={selected}
      options={options.map((value) => ({ value, label: purposeLabel(value) }))}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      disabled={locked}
      onChange={(event) => change(event.target.value)}
    />
  )
}

function DefaultStarToggle({ form, disabled, label = 'Set as primary', tooltip = label }) {
  const selected = useWatch({ control: form.control, name: 'setAsDefault' })
  return (
    <span className="supplier-primary-control">
      <Tooltip content={tooltip}>
        <button
          type="button"
          className="supplier-primary-star"
          aria-label={label}
          aria-pressed={Boolean(selected)}
          disabled={disabled || form.formState.isSubmitting}
          onClick={() => form.setValue('setAsDefault', !selected, {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: true,
          })}
        >
          <Star size={20} fill={selected ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      </Tooltip>
    </span>
  )
}

function AddressGeography({ onChanged }) {
  const { watch, setValue, formState } = useFormContext()
  const values = {
    country: watch('country') || '',
    stateCode: watch('stateCode') || '',
    region: watch('region') || '',
  }

  return (
    <div
      className="form-grid"
      onChangeCapture={() => onChanged?.()}
    >
      <GeographyFields
        values={values}
        errors={{
          country: formState.errors.country?.message,
          stateCode: formState.errors.stateCode?.message,
        }}
        change={(patch) => {
          onChanged?.()
          for (const [key, value] of Object.entries(patch)) {
            setValue(key, value, { shouldDirty: true, shouldValidate: true })
          }
        }}
      />
    </div>
  )
}

function ContactFormFields({ locked, showDefault, defaults }) {
  return (
    <div className="supplier-form-fields">
      {showDefault ? (
        <ErrorNotice error={defaults.error} retry={defaults.reload} />
      ) : null}
      <div className="form-grid">
        <FormTextField
          name="name"
          label="Name"
          required
          maxLength={160}
          autoFocus
          disabled={locked}
        />
        <FormTextField
          name="jobTitle"
          label="Job title"
          maxLength={120}
          disabled={locked}
          placeholder="Account manager"
        />
      </div>
      <div className="form-grid">
        <FormTextField
          name="email"
          label="Email"
          type="email"
          required
          maxLength={254}
          disabled={locked}
          placeholder="name@example.com"
        />
        <FormPhoneField
          name="phone"
          label="Phone"
          disabled={locked}
        />
      </div>
      <PurposeFields
        options={contactPurposes}
        legend="Contact responsibilities"
        disabled={locked}
      />
    </div>
  )
}

function AddressFormFields({ locked, showDefault, defaults, onGeographyChanged }) {
  return (
    <div className="supplier-form-fields">
      {showDefault ? (
        <ErrorNotice error={defaults.error} retry={defaults.reload} />
      ) : null}
      <FormTextField
        name="label"
        label="Label"
        maxLength={80}
        autoFocus
        disabled={locked}
        placeholder="Receiving dock"
      />
      <div className="form-grid">
        <FormTextField
          name="line1"
          label="Address line 1"
          maxLength={160}
          disabled={locked}
        />
        <FormTextField
          name="line2"
          label="Address line 2"
          maxLength={160}
          disabled={locked}
        />
      </div>
      <div className="form-grid">
        <FormTextField
          name="city"
          label="City"
          maxLength={100}
          disabled={locked}
        />
        <FormTextField
          name="postalCode"
          label="Postal code"
          maxLength={32}
          disabled={locked}
        />
      </div>
      <AddressGeography onChanged={onGeographyChanged} />
      <PurposeFields
        options={Object.keys(addressPurposes)}
        legend="Address purposes"
        required
        placeholder="Select address purposes"
        searchPlaceholder="Search address purposes"
        disabled={locked}
      />
    </div>
  )
}

function RestoreContactForm({ locked }) {
  return (
    <div className="supplier-form-fields">
      <FormSection title="Restore contact">
        <div className="form-grid">
          <FormTextField
            name="email"
            label="Email"
            type="email"
            required
            maxLength={254}
            autoFocus
            disabled={locked}
          />
          <div className="supplier-form-field-note" aria-hidden="true">
            <p className="supplier-form-field-note-title">Required</p>
            <p className="muted">
              Restoring needs a current email before this contact can be used
              again.
            </p>
          </div>
        </div>
      </FormSection>
    </div>
  )
}

function ChildConflictReview({ error, path, onReview, isContact }) {
  const values = useWatch()
  return (
    <ConflictReview
      error={error}
      path={path}
      values={
        isContact
          ? {
              name: values.name || '',
              email: values.email || '',
              phone: values.phone || '',
              jobTitle: values.jobTitle || '',
              purposes: values.purposes || [],
            }
          : {
              label: values.label || '',
              line1: values.line1 || '',
              line2: values.line2 || '',
              city: values.city || '',
              postalCode: values.postalCode || '',
              country: values.country || '',
              stateCode: values.stateCode || '',
              purposes: values.purposes || [],
            }
      }
      onReview={onReview}
    />
  )
}

export function SupplierChildEditor({ kind, base, record, close, saved }) {
  const isContact = kind === 'contacts'
  const restoring = isContact && record.status === 'archived'
  const mutation = useMutation()
  const locked = mutation.pending || mutation.uncertain
  const defaults = useResource(!record._id ? `${base}/defaults` : null)
  const [revision, setRevision] = useState(record.revision)
  const [geographyChanged, setGeographyChanged] = useState(false)

  const schema = restoring
    ? supplierContactRestoreSchema
    : isContact
      ? supplierContactFormSchema
      : supplierAddressFormSchema

  const form = useAppForm(schema, {
    defaultValues: restoring
      ? { email: record.email || '' }
      : isContact
        ? supplierContactToFormValues(record)
        : supplierAddressToFormValues(record),
  })

  useEffect(() => {
    const fields = mutation.error?.fields
    if (!Array.isArray(fields)) return
    for (const field of fields) {
      const name = field?.field?.replace(/^address\./, '')
      if (name && field.message) {
        form.setError(name, {
          type: 'server',
          message: String(field.message),
        })
      }
    }
  }, [form, mutation.error])

  async function onSubmit(values) {
    let body
    if (restoring) {
      body = {
        expectedRevision: revision,
        email: values.email.trim(),
      }
    } else if (isContact) {
      body = {
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim() || null,
        jobTitle: values.jobTitle.trim() || null,
        purposes: values.purposes || [],
      }
      if (record._id) body.expectedRevision = revision
      else if (values.setAsDefault && defaults.data) {
        body.setDefaults = {
          expectedRevision: defaults.data.defaults.revision,
          primaryContact: true,
        }
      }
    } else {
      const address = {
        line1: values.line1.trim() || null,
        line2: values.line2.trim() || null,
        city: values.city.trim() || null,
        postalCode: values.postalCode.trim() || null,
      }
      if (!record._id || geographyChanged) {
        Object.assign(address, {
          country: values.country || null,
          stateCode: values.stateCode || null,
        })
      }
      body = {
        label: values.label.trim() || null,
        purposes: values.purposes || [],
        address,
      }
      if (record._id) body.expectedRevision = revision
      else if (values.setAsDefault && defaults.data) {
        body.setDefaults = {
          expectedRevision: defaults.data.defaults.revision,
          purposes: values.purposes || [],
        }
      }
    }

    if (
      await mutation.run(
        restoring ? 'post' : record._id ? 'patch' : 'post',
        `${base}/${kind}${record._id ? `/${record._id}${restoring ? '/restore' : ''}` : ''}`,
        body,
      )
    )
      saved()
  }

  const action = record._id ? (restoring ? 'Restore' : 'Edit') : 'Add'
  const title = `${action} ${isContact ? 'contact' : 'address'}`

  return (
    <Dialog
      size={restoring ? 'sm' : 'lg'}
      className="supplier-form-dialog"
      title={title}
      headerAction={!record._id ? (
        <DefaultStarToggle
          form={form}
          disabled={!defaults.data || locked}
          label={isContact ? 'Set as primary' : 'Set as default'}
          tooltip={isContact ? 'Set as primary' : 'Set as default for selected purposes'}
        />
      ) : null}
      close={close}
      locked={locked}
      hasUnsavedChanges={form.formState.isDirty}
    >
      <AppFormProvider
        form={form}
        onSubmit={onSubmit}
        animated={false}
        className="supplier-form"
      >
        {restoring ? (
          <RestoreContactForm locked={locked} />
        ) : isContact ? (
          <ContactFormFields
            locked={locked}
            showDefault={!record._id}
            defaults={defaults}
          />
        ) : (
          <AddressFormFields
            locked={locked}
            showDefault={!record._id}
            defaults={defaults}
            onGeographyChanged={() => setGeographyChanged(true)}
          />
        )}

        {!restoring ? (
          <ChildConflictReview
            error={mutation.error}
            path={record._id ? `${base}/${kind}/${record._id}` : null}
            onReview={(current) => setRevision(current.revision)}
            isContact={isContact}
          />
        ) : null}

        <SaveFooter
          mutation={mutation}
          close={close}
          label="Save"
          onClear={() => setGeographyChanged(false)}
        />
      </AppFormProvider>
    </Dialog>
  )
}
