import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../../services/api'
import { getAuthClient } from '../../services/auth'
import { mutate, paymentDestination } from '../../services/workspace'
import { FormApiAlert } from '../forms/FormApiAlert'
import { Action, Loading } from './Elements'

export function PaymentHandoff({ request, snapshot, reload, done }) {
  const mounted = useRef(false)
  const locked = useRef(false)
  const attempted = useRef(false)
  const [notBefore] = useState(() => Date.now() + 120000)
  const [observed, setObserved] = useState(() => Date.now())
  const [state, setState] = useState({
    pending: false,
    error: null,
    result: null,
    retryAt: 0,
  })
  const path = `/applications/${request.applicationId}/billing`
  const status = snapshot.billing
  const recovering =
    request.kind === 'recover' ||
    ['checkout_creating', 'checkout_pending'].includes(status?.status)
  const waiting =
    snapshot.nextAction === 'wait_billing' ||
    status?.synchronization === 'pending'
  const suggested = Date.parse(status?.retryAfter || snapshot.retryAfter || '')
  const recoveryAt = Math.max(
    notBefore,
    Number.isFinite(suggested) ? suggested : 0,
  )
  const delayUntil = Math.max(
    recovering && waiting ? recoveryAt : 0,
    state.retryAt,
  )
  const finished = [
    'review_and_start',
    'activate_workspace',
    'open_workspace',
    'choose_workspace',
  ].includes(snapshot.nextAction)
  const available =
    snapshot.offer?.state === 'available' &&
    snapshot.offer.checkoutAllowed &&
    snapshot.platform?.ready
  const matches =
    available &&
    request.body?.expectedOfferRevision === snapshot.offer.offer.revision &&
    request.body?.termsVersion === snapshot.offer.consent.termsVersion
  const reviewChanged = !recovering && available && !matches
  const expiredRecovery =
    recovering &&
    snapshot.offer?.state === 'available' &&
    snapshot.nextAction === 'review_offer'
  const ready =
    snapshot.actorId === request.actorId &&
    snapshot.setup?.complete &&
    !finished &&
    !reviewChanged &&
    !status?.cancellation?.state &&
    (recovering
      ? snapshot.nextAction === 'recover_payment' ||
        (snapshot.nextAction === 'wait_billing' && observed >= delayUntil)
      : snapshot.nextAction === 'review_offer' && matches)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    if (observed >= delayUntil) return
    const timer = setTimeout(
      () => setObserved(Date.now()),
      Math.max(0, delayUntil - Date.now()),
    )
    return () => clearTimeout(timer)
  }, [observed, delayUntil])
  const openPayment = useCallback(async () => {
    if (locked.current || !mounted.current) return
    locked.current = true
    try {
      const session = await getAuthClient().auth.getSession()
      if (!mounted.current) return
      if (session.data.session?.user.id !== request.subjectId)
        throw new ApiError(
          'Your account changed. Sign in again before continuing to payment.',
          { status: 401, code: 'ACCOUNT_CHANGED' },
        )
      setState({ pending: true, error: null, result: null, retryAt: 0 })
      const result = recovering
        ? await mutate('post', `${path}/recovery`, {}, { idempotent: false })
        : await mutate('post', `${path}/checkout`, request.body)
      const currentSession = await getAuthClient().auth.getSession()
      if (
        !mounted.current ||
        currentSession.data.session?.user.id !== request.subjectId
      )
        return
      const url = recovering ? result.paymentUrl : result.checkoutUrl
      if (url) {
        // Same-tab navigation avoids popup blockers after async work.
        window.location.href = paymentDestination(url)
        return
      }
      if (!recovering)
        throw new ApiError(
          'The payment link was missing. Please retry, or review billing here.',
          { status: 502, code: 'INVALID_CHECKOUT_RESPONSE' },
        )
      // Recovery may still be processing; keep a Retry path instead of failing silently.
      setState({
        pending: false,
        error: new ApiError(
          'The payment link was not ready yet. Retry when the waiting period ends.',
          { status: 502, code: 'INVALID_PAYMENT_RESPONSE' },
        ),
        result,
        retryAt: Date.now() + 120000,
      })
      reload()
    } catch (error) {
      if (!mounted.current) return
      if (
        [
          'OFFER_REVISION_CONFLICT',
          'CHECKOUT_ALREADY_STARTED',
          'APPROVAL_REQUIRED',
          'INVALID_PAYMENT_URL',
          'INVALID_CHECKOUT_RESPONSE',
        ].includes(error.code)
      ) {
        done(error)
        reload()
        return
      }
      setState({
        pending: false,
        error,
        result: null,
        retryAt: error.retryAfterMs ? Date.now() + error.retryAfterMs : 0,
      })
    } finally {
      locked.current = false
    }
  }, [path, recovering, reload, request, done])
  useEffect(() => {
    if (finished) {
      done()
      return
    }
    if (expiredRecovery || snapshot.nextAction === 'contact_support') {
      done()
      return
    }
    if (reviewChanged) {
      done(
        new ApiError(
          'The billing offer changed. Review the current price and accept its terms before continuing.',
          { status: 409, code: 'OFFER_REVISION_CONFLICT' },
        ),
      )
      return
    }
    if (!ready || attempted.current) return
    attempted.current = true
    void openPayment()
  }, [
    ready,
    finished,
    reviewChanged,
    expiredRecovery,
    snapshot.nextAction,
    openPayment,
    done,
  ])

  return (
    <section className="panel" aria-label="Continue to secure payment">
      <h2>
        {state.pending
          ? 'Redirecting to payment…'
          : 'Your company details are saved'}
      </h2>
      <p>
        {state.result?.state === 'support_required'
          ? 'Your existing billing setup needs support review. Keep the request reference shown below.'
          : state.error
            ? 'Payment could not be opened automatically. Retry below, or review billing here.'
            : state.result
              ? 'Your existing payment setup is still processing. Check its status or retry opening it when the waiting period ends.'
              : 'We will open your secure Stripe page automatically when your current setup step is ready.'}
      </p>
      {state.pending && <Loading label="Redirecting to payment…" />}
      <FormApiAlert
        error={state.error}
        onRetry={
          !state.pending &&
          state.error &&
          state.result?.state !== 'support_required'
            ? () => {
                attempted.current = false
                void openPayment()
              }
            : undefined
        }
        retryLabel="Retry"
        retryDisabled={!ready || observed < delayUntil}
      />
      {!state.pending &&
        !state.error &&
        state.result &&
        state.result?.state !== 'support_required' && (
          <Action
            disabled={!ready || observed < delayUntil}
            onClick={openPayment}
          >
            Retry
          </Action>
        )}
      <Action
        variant="secondary"
        disabled={state.pending}
        onClick={() => done()}
      >
        Review billing here
      </Action>
    </section>
  )
}
