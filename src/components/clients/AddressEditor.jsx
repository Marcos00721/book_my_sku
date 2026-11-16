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

function AddressGeography({ changed }) {
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
    <div className="form-grid client-address-wide">
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
          changed()
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

  useEffect(() => {
    const frame = requestAnimationFrame(() => form.setFocus('label'))
    return () => cancelAnimationFrame(frame)
  }, [form])

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
      size="md"
      className="client-address-editor"
      title={address.id ? 'Edit address' : 'Add address'}
      close={close}
      locked={locked}
    >
      <AppFormProvider
        form={form}
        onSubmit={onSubmit}
        animated={false}
        className="client-address-form"
      >
        <fieldset className="client-address-fields" disabled={locked}>
          <div className="form-grid">
            <FormTextField name="label" label="Label" required maxLength={80} disabled={locked} placeholder="e.g. Head office" />
            <FormSelectField name="usage" label="Address type" disabled={locked}>
              <option value="billing">Billing</option>
              <option value="shipping">Shipping</option>
              <option value="both">Billing &amp; shipping</option>
            </FormSelectField>
            <FormTextField name="companyName" label="Company name" className="client-address-wide" required maxLength={160} autoComplete="organization" disabled={locked} />
            <FormTextField name="line1" label="Address line 1" required maxLength={160} autoComplete="address-line1" disabled={locked} />
            <FormTextField name="line2" label="Address line 2" maxLength={160} autoComplete="address-line2" disabled={locked} />
            <FormTextField name="city" label="City" required maxLength={100} autoComplete="address-level2" disabled={locked} />
            <FormTextField name="postalCode" label="Postal code" required maxLength={32} autoComplete="postal-code" disabled={locked} />
            <AddressGeography changed={() => setGeographyChanged(true)} />
          </div>
          {address.id ? (
            <div className="client-address-status">
              <FormCheckbox name="active">Active address</FormCheckbox>
              <p className="muted">Deactivating or changing the address type clears incompatible defaults.</p>
            </div>
          ) : null}
        </fieldset>
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
