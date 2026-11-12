import { useEffect, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { useMutation } from '../../hooks/useMutation'
import { useResource } from '../../hooks/useResource'
import {
  addressFormSchema,
  addressToFormValues,
} from '../../schemas/clientTabFormSchemas'
import { AppFormProvider } from '../forms/AppFormProvider'
import { FormSelectField } from '../forms/FormSelectField'
import { FormTextField } from '../forms/FormTextField'
import { useAppForm } from '../forms/useAppForm'
import { GeographyFields } from '../workspace/GeographyFields'
import { Dialog, SaveFooter } from '../workspace/Elements'
import { FormCheckbox } from '../forms/FormCheckbox'

const NO_STATE = '__none__'

function AddressGeography() {
  const { watch, setValue, formState } = useFormContext()
  const values = {
    country: watch('country') || '',
    stateCode: watch('stateCode') || '',
    region: watch('region') || '',
  }
  const countries = useResource('/reference/countries')
  const country = (countries.data?.countries || []).find(
    (item) => item.code === values.country,
  )

  useEffect(() => {
    if (!values.country) return
    if (country?.stateRequirement === 'not_applicable') {
      setValue('stateCode', NO_STATE, {
        shouldDirty: true,
        shouldValidate: true,
      })
    } else if (values.stateCode === NO_STATE) {
      setValue('stateCode', '', { shouldDirty: true, shouldValidate: true })
    }
  }, [country, setValue, values.country, values.stateCode])

  return (
    <div className="form-grid">
      <GeographyFields
        requireState
        values={{
          ...values,
          stateCode: values.stateCode === NO_STATE ? '' : values.stateCode,
        }}
        errors={{
          country: formState.errors.country?.message,
          stateCode: formState.errors.stateCode?.message,
        }}
        change={(patch) => {
          for (const [key, value] of Object.entries(patch)) {
            setValue(key, value, { shouldDirty: true, shouldValidate: true })
          }
        }}
      />
    </div>
  )
}

export function AddressEditor({ path, address, close, saved }) {
  const mutation = useMutation()
  const [geographyChanged, setGeographyChanged] = useState(false)
  const locked = mutation.pending || mutation.uncertain
  const form = useAppForm(addressFormSchema, {
    defaultValues: addressToFormValues(address),
  })

  async function onSubmit(values) {
    const stateCode =
      values.stateCode === NO_STATE ? null : values.stateCode || null
    const payload = {
      label: values.label.trim(),
      companyName: values.companyName.trim(),
      usage: values.usage,
      address: {
        line1: values.line1.trim(),
        line2: values.line2.trim() || null,
        city: values.city.trim(),
        postalCode: values.postalCode.trim(),
      },
      ...(address.id
        ? { expectedRevision: address.revision, active: values.active }
        : {}),
    }
    if (!address.id || geographyChanged) {
      payload.address.country = values.country || null
      payload.address.stateCode = stateCode
    }
    if (
      await mutation.run(
        address.id ? 'patch' : 'post',
        `${path}/addresses${address.id ? `/${address.id}` : ''}`,
        payload,
      )
    )
      saved()
  }

  return (
    <Dialog
      className="supplier-form-dialog"
      title={address.id ? 'Edit' : 'Create'}
      description="Store a billing or shipping place your team can reuse on the next project."
      close={close}
      locked={locked}
    >
      <AppFormProvider
        form={form}
        onSubmit={onSubmit}
        animated={false}
        className="supplier-form"
      >
        <div className="supplier-form-fields">
          <section className="supplier-form-section">
            <h3 className="supplier-form-section-title">Address details</h3>
            <div className="supplier-form-section-body">
              <div className="form-grid">
                <FormTextField
                  name="label"
                  label="Label"
                  required
                  maxLength={80}
                  disabled={locked}
                />
                <FormTextField
                  name="companyName"
                  label="Company name"
                  required
                  maxLength={160}
                  disabled={locked}
                />
              </div>
              <div className="form-grid">
                <FormSelectField
                  name="usage"
                  label="Use this address for"
                  disabled={locked}
                >
                  <option value="billing">Billing</option>
                  <option value="shipping">Shipping</option>
                  <option value="both">
                    Billing & shipping (shared record)
                  </option>
                </FormSelectField>
                <FormTextField
                  name="postalCode"
                  label="Postal code"
                  required
                  maxLength={32}
                  disabled={locked}
                />
              </div>
              <div className="form-grid">
                <FormTextField
                  name="line1"
                  label="Address line 1"
                  required
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
                  required
                  maxLength={100}
                  disabled={locked}
                />
                <div className="supplier-form-field-note" aria-hidden="true">
                  <p className="supplier-form-field-note-title">Tip</p>
                  <p className="muted">
                    Pick a label your team will recognize on invoices and
                    deliveries.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="supplier-form-section">
            <h3 className="supplier-form-section-title">Location</h3>
            <div
              className="supplier-form-section-body"
              onChangeCapture={() => setGeographyChanged(true)}
            >
              <AddressGeography />
            </div>
          </section>

          {address.id ? (
            <section className="supplier-form-section">
              <h3 className="supplier-form-section-title">Status</h3>
              <div className="supplier-form-section-body">
                <FormCheckbox name="active">
                  Active address. Deactivating or changing its use clears
                  incompatible defaults.
                </FormCheckbox>
              </div>
            </section>
          ) : null}
        </div>
        <SaveFooter mutation={mutation} close={close} label="Save" />
      </AppFormProvider>
    </Dialog>
  )
}
