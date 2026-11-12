import { useResource } from '../../hooks/useResource'
import { ErrorNotice, Field, Loading } from './Elements'

export function GeographyFields({
  values,
  change,
  errors = {},
  requireState = false,
}) {
  const countries = useResource('/reference/countries')
  const states = useResource(
    values.country
      ? `/reference/countries/${encodeURIComponent(values.country)}/states`
      : null,
  )
  const catalog = countries.data?.countries || []
  const country = catalog.find((item) => item.code === values.country)
  const choices = states.data?.states || []
  if (countries.loading) return <Loading label="Loading countries…" />
  return (
    <>
      <ErrorNotice error={countries.error} retry={countries.reload} />
      <Field
        name="country"
        label="Country"
        required
        error={errors.country}
        value={values.country}
        onChange={(event) =>
          change({ country: event.target.value, stateCode: '', region: '' })
        }
      >
        <option value="">Choose a country</option>
        {values.country && !country && (
          <option value={values.country}>
            Saved country: {values.country}
          </option>
        )}
        {catalog.map((item) => (
          <option key={item.code} value={item.code}>
            {item.name}
          </option>
        ))}
      </Field>
      {values.country ? (
        <>
          <ErrorNotice error={states.error} retry={states.reload} />
          <Field
            name="stateCode"
            label={country?.stateLabel || 'State / region'}
            required={
              requireState && country?.stateRequirement !== 'not_applicable'
            }
            error={errors.stateCode}
            value={values.stateCode}
            disabled={
              states.loading ||
              Boolean(states.error) ||
              country?.stateRequirement === 'not_applicable'
            }
            onChange={(event) => change({ stateCode: event.target.value })}
          >
            <option value="">
              {states.loading
                ? 'Loading states…'
                : country?.stateRequirement === 'not_applicable'
                  ? 'Not applicable'
                  : 'Choose a state'}
            </option>
            {values.stateCode &&
              !choices.some((item) => item.code === values.stateCode) && (
                <option value={values.stateCode}>
                  Saved state: {values.stateCode}
                </option>
              )}
            {choices.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </Field>
          {!values.stateCode && values.region ? (
            <p className="muted">
              Saved region: {values.region}. Select its state to complete this
              address.
            </p>
          ) : null}
        </>
      ) : null}
    </>
  )
}
