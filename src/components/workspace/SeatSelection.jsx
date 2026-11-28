import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { api } from '../../services/api'
import { Action, ErrorNotice, Field } from './Elements'

export function SeatSelection({ path, preview, children }) {
  const [quote, setQuote] = useState(null)
  const [error, setError] = useState(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { quantity: preview.initialQuantity ?? 1 },
    mode: 'onTouched',
  })
  async function review({ quantity }) {
    setError(null)
    try {
      const selectedQuantity = Number(quantity)
      const { data } = await api.get(`${path}/offer?quantity=${selectedQuantity}`)
      if (data.state !== 'available' || data.checkoutMode !== 'subscription' ||
        data.initialQuantity !== selectedQuantity || data.firstCharge?.quantity !== selectedQuantity ||
        !Number.isSafeInteger(data.firstCharge?.amountMinor) || data.firstCharge.amountMinor < 0 ||
        data.firstCharge.currency !== data.offer?.currency ||
        !Array.isArray(data.offer?.phases) || data.offer.phases.length === 0 ||
        !data.offer.phases.every(phase => Number.isSafeInteger(phase.unitAmountMinor) &&
          phase.unitAmountMinor >= 0 && Number.isSafeInteger(phase.unitAmountMinor * selectedQuantity))) {
        throw new Error('Seat pricing could not be confirmed. Refresh your billing details and try again.')
      }
      setQuote({ ...data, checkoutAllowed: preview.checkoutAllowed && data.checkoutAllowed })
    } catch (failure) {
      setError(failure)
    }
  }
  if (quote) return children(quote, () => setQuote(null))
  return (
    <form noValidate onSubmit={handleSubmit(review)} className="space-y-md">
      <h3>How many seats do you need?</h3>
      <p className="muted">Include yourself in the total. For example, 5 seats covers you and 4 teammates. You pay for all selected seats, even before inviting your team.</p>
      <Field
        label="Number of seats"
        type="number"
        min="1"
        max="1000"
        step="1"
        required
        disabled={isSubmitting}
        {...register('quantity', {
          required: 'Enter the number of seats.',
          validate: value => Number.isSafeInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 1000 || 'Enter a whole number from 1 to 1000.',
        })}
        error={errors.quantity?.message}
      />
      <ErrorNotice error={error} />
      <Action type="submit" disabled={isSubmitting || !preview.checkoutAllowed}>
        {isSubmitting ? 'Calculating your total…' : 'Review seat pricing'}
      </Action>
    </form>
  )
}
