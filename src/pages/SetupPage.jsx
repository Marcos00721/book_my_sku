import { useEffect, useRef, useState } from "react";
import { useDraftGuard } from "../hooks/useDraftGuard";
import { useJourneyStatus } from "../hooks/useJourneyStatus";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { getAuthClient } from "../services/auth";
import { createOnboardingCoordinator } from "../services/onboardingCoordinator";
import { ConflictReview } from "../components/workspace/RecordTools";
import { Navigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { BrandMark } from "../components/auth/BrandMark";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { ButtonLink } from "../components/common/ButtonLink";
import { BillingPanel } from "../components/workspace/BillingPanel";
import { GeographyFields } from "../components/workspace/GeographyFields";
import { CheckoutTerms } from "../components/workspace/CheckoutTerms";
import { PaymentHandoff } from "../components/workspace/PaymentHandoff";
import {
  Action,
  ErrorNotice,
  Loading,
  PageHeader,
  Status,
} from "../components/workspace/Elements";
import { useMutation } from "../hooks/useMutation";
import { AppFormProvider } from "../components/forms/AppFormProvider";
import { FormTextField } from "../components/forms/FormTextField";
import { FormSubmitButton } from "../components/forms/FormSubmitButton";
import { FormApiAlert } from "../components/forms/FormApiAlert";
import { useAppForm } from "../components/forms/useAppForm";
import {
  companySetupDefaults,
  companySetupFormSchema,
  companySetupPayload,
} from "../schemas/companySetupSchema";

export function SetupPage() {
  const journey = useJourneyStatus();
  const [handoff, setHandoff] = useState(null);
  const [paymentError, setPaymentError] = useState(null);
  if (journey.loading) return <Loading label="Loading your setup progress…" />;
  if (!journey.data)
    return <ErrorNotice error={journey.error} retry={journey.reload} />;
  const current = journey.data;
  const assistedGrant =
    import.meta.env.VITE_ASSISTED_ONBOARDING_ENABLED === "true" &&
    current.assisted?.current?.scope === "organization" &&
    current.assisted.current.state === "accepted"
      ? current.assisted.current
      : null;
  const action = current.nextAction;
  if (
    ["open_workspace", "choose_workspace", "contact_owner"].includes(action) &&
    !(assistedGrant && current.setup)
  )
    return <Navigate to="/app" replace />;
  if (
    [
      "verify_email",
      "choose_onboarding",
      "resume_registration",
      "submit_application",
      "correct_application",
      "await_review",
    ].includes(action)
  )
    return <Navigate to="/register" replace />;
  if (action === "resume_invitation")
    return <Navigate to="/team/accept" replace />;
  if (action === "accept_assisted_invitation")
    return <Navigate to="/assisted/accept" replace />;
  if (action === "prepare_assisted_workspace" && !current.setup)
    return <Navigate to="/assisted" replace />;
  const collectAtFinish =
    !assistedGrant &&
    current.setup &&
    !current.setup.complete &&
    !current.setup.locked &&
    current.offer?.state === "available" &&
    current.offer.checkoutAllowed &&
    current.platform?.ready === true;
  function changed(nextJourney, paymentRequest) {
    if (paymentRequest) {
      setPaymentError(null);
      setHandoff({ ...paymentRequest, actorId: nextJourney.actorId });
    }
    if (nextJourney?.actorId === current.actorId) journey.accept(nextJourney);
    else journey.reload();
  }
  return (
    <div className="setup-layout">
      <header className="setup-top">
        <BrandMark />
        <div className="actions">
          <ButtonLink variant="secondary" to="/app">
            Workspace
          </ButtonLink>
          <Action variant="secondary" onClick={journey.reload}>
            Check current status
          </Action>
          <ThemeToggle />
        </div>
      </header>
      <PageHeader
        eyebrow="LET’S MAKE IT YOURS"
        title="Your next chapter starts here."
        description="Complete your company details, then follow the payment and workspace steps below."
      />
      <ErrorNotice error={journey.error} retry={journey.reload} />
      <ErrorNotice error={paymentError} />
      {journey.pollingExhausted && (
        <p className="notice">
          Automatic checks have paused after several attempts. Check the current
          status manually, or contact support if billing remains pending.
        </p>
      )}
      {action === "contact_support" && (
        <p className="notice">
          Your workspace needs support review. Your company details and existing
          payment remain in place. {current.platform?.reason}
        </p>
      )}
      {current.setup && (
        <CompanySetup
          key={current.actorId}
          actorId={current.actorId}
          setup={current.setup}
          organization={current.provisioning}
          nextAction={action}
          assistedGrantId={assistedGrant?.id}
          assistedEligible={assistedGrant?.access?.eligible}
          applicationId={current.application?.id}
          paymentPreview={collectAtFinish ? current.offer : null}
          resumeCheckout={
            !assistedGrant &&
            ["checkout_creating", "checkout_pending"].includes(
              current.billing?.status,
            )
          }
          changed={changed}
        />
      )}
      {handoff ? (
        <PaymentHandoff
          request={handoff}
          snapshot={current}
          reload={journey.reload}
          done={(error) => {
            setHandoff(null);
            if (error) setPaymentError(error);
          }}
        />
      ) : assistedGrant ? (
        <section className="panel">
          <h2>Assisted billing checklist</h2>
          <p className="muted">
            Review your accepted agreement and future billing requirements
            separately.
          </p>
          <ButtonLink variant="secondary" to="/assisted">
            Review assisted billing
          </ButtonLink>
        </section>
      ) : current.application?.status === "approved" &&
        current.billing &&
        current.offer &&
        action !== "contact_support" &&
        !collectAtFinish ? (
        <BillingPanel
          key={current.application.id}
          applicationId={current.application.id}
          snapshot={current}
          changed={changed}
        />
      ) : null}
    </div>
  );
}

function CompanySetup({
  actorId,
  setup,
  organization,
  nextAction,
  assistedGrantId,
  assistedEligible,
  applicationId,
  paymentPreview,
  resumeCheckout,
  changed,
}) {
  const mutation = useMutation();
  const preparation = useMutation();
  const [editing, setEditing] = useState(!setup.complete && !setup.locked);
  async function activate() {
    if (
      await mutation.run(
        "post",
        "/onboarding/activate",
        {},
        { idempotent: false },
      )
    )
      changed();
  }
  async function prepare() {
    const path = assistedGrantId
      ? "/assisted/" + assistedGrantId + "/prepare"
      : "/onboarding/setup/prepare";
    if (await preparation.run("post", path, {})) changed();
  }
  const mayPrepare =
    nextAction === "prepare_workspace" ||
    (nextAction === "prepare_assisted_workspace" &&
      assistedGrantId &&
      assistedEligible &&
      setup.complete &&
      !["prepared", "active"].includes(organization?.status) &&
      organization?.provisioning?.state !== "in_progress");
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Company details</h2>
        <Status value={setup.complete ? "complete" : "in progress"} />
      </div>
      {(setup.locked || setup.complete) && !editing ? (
        <>
          <p className="muted">
            {setup.locked
              ? organization?.status === "prepared"
                ? "Your company details are saved and locked. Your workspace is prepared; complete the card and billing steps below."
                : "Your company details are locked while your workspace is provisioned."
              : "Company details are complete. Follow the current workspace step before continuing."}
          </p>
          {organization && (
            <div className="notice">
              <Status value={organization.status} />
              <p>{organization.provisioning?.state?.replaceAll("_", " ")}</p>
              {organization.failureCode && <p>{organization.failureCode}</p>}
            </div>
          )}
          <ErrorNotice
            error={mutation.error || preparation.error}
            retry={changed}
          />
          <div className="actions">
            {nextAction === "wait_provisioning" ? (
              <p className="notice">
                Your workspace is being prepared. Status checks run with bounded
                backoff; you can also check the current status above.
              </p>
            ) : organization?.status === "active" ? (
              <p className="notice">
                Your workspace is active. Company details and future billing
                requirements remain separate.
              </p>
            ) : mayPrepare ? (
              <Action disabled={preparation.pending} onClick={prepare}>
                {preparation.pending
                  ? "Preparing workspace…"
                  : preparation.uncertain
                    ? "Retry preparation"
                    : "Prepare workspace"}
                <ArrowRight size={16} />
              </Action>
            ) : nextAction === "activate_workspace" ? (
              <Action disabled={mutation.pending} onClick={activate}>
                {mutation.pending
                  ? "Activating workspace…"
                  : "Activate workspace"}
                <ArrowRight size={16} />
              </Action>
            ) : null}
            {!setup.locked && nextAction !== "contact_support" && (
              <Action
                variant="secondary"
                disabled={
                  mutation.pending ||
                  mutation.uncertain ||
                  preparation.pending ||
                  preparation.uncertain
                }
                onClick={() => setEditing(true)}
              >
                Edit company details
              </Action>
            )}
          </div>
        </>
      ) : (
        <CompanyForm
          actorId={actorId}
          setup={setup}
          readOnly={setup.locked}
          applicationId={applicationId}
          paymentPreview={paymentPreview}
          resumeCheckout={resumeCheckout}
          saved={(nextJourney, paymentRequest) => {
            setEditing(false);
            changed(nextJourney, paymentRequest);
          }}
        />
      )}
    </section>
  );
}

function CompanyForm({
  actorId,
  setup,
  readOnly,
  saved,
  applicationId,
  paymentPreview,
  resumeCheckout,
}) {
  const form = useAppForm(companySetupFormSchema, {
    defaultValues: companySetupDefaults(setup),
  })
  const { isDirty, isSubmitting } = form.formState
  useDraftGuard(isDirty)

  const [revision, setRevision] = useState(setup.revision)
  const [savedRevision, setSavedRevision] = useState(setup.revision > 0)
  const [coordinator, setCoordinator] = useState(null)
  const factory = useRef(null)
  const initialSetup = useRef(setup)
  const subjectId = useRef(null)
  const [acceptedPayment, setAcceptedPayment] = useState('')
  const [redirectingToPayment, setRedirectingToPayment] = useState(false)
  const paymentBody = paymentPreview
    ? {
        expectedOfferRevision: paymentPreview.offer.revision,
        recurringConsent: true,
        termsVersion: paymentPreview.consent.termsVersion,
      }
    : null
  const paymentKey = paymentBody
    ? JSON.stringify([applicationId, paymentBody])
    : ''
  const paymentAccepted = Boolean(paymentKey && paymentKey === acceptedPayment)
  const [state, setState] = useState({
    pending: false,
    error: null,
    uncertain: false,
  })
  const navigate = useNavigate()
  const mutation = state
  const completion = state
  const geographyValues = form.watch()

  function clearApiError() {
    setState((current) =>
      current.error || current.uncertain
        ? { ...current, error: null, uncertain: false }
        : current,
    )
  }

  useEffect(() => {
    if (!state.error) return undefined
    const subscription = form.watch(() => clearApiError())
    return () => subscription.unsubscribe()
  }, [form, state.error])

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    async function initialize() {
      try {
        const { data } = await getAuthClient().auth.getSession()
        const subject = data.session?.user.id
        if (!active) return
        if (!actorId || !subject)
          throw new Error(
            'Your setup identity could not be confirmed. Reload your session.',
          )
        subjectId.current = subject
        factory.current = (reviewed) => {
          let seed = reviewed
          const baseline = reviewed || initialSetup.current
          return createOnboardingCoordinator({
            allowCompletedEdits: baseline.complete && !baseline.locked,
            actorId,
            currentActorId: () => (active ? actorId : null),
            withLock: async (name, task) => {
              if (!navigator.locks)
                throw new Error(
                  'This browser cannot coordinate setup across tabs. Use a browser with Web Locks support.',
                )
              return navigator.locks.request(name, task)
            },
            request: async (method, path, body) => {
              const current = await getAuthClient().auth.getSession()
              if (!active || current.data.session?.user.id !== subject)
                throw new Error(
                  'Your account changed. Reload setup before continuing.',
                )
              if (method === 'GET' && path === '/onboarding/setup' && seed) {
                const result = seed
                seed = null
                return result
              }
              const options = { signal: controller.signal }
              return (
                await (method === 'GET'
                  ? api.get(path, options)
                  : api[method.toLowerCase()](path, body, options))
              ).data
            },
            refreshPermissions: async (workspaces) => {
              for (const org of workspaces.items.filter(
                (item) => item.status === 'active',
              ))
                await Promise.all([
                  api.get(`/organizations/${org.id}/permissions`, {
                    signal: controller.signal,
                  }),
                  api.get(`/organizations/${org.id}/access`, {
                    signal: controller.signal,
                  }),
                ])
              window.dispatchEvent(new Event('workspace-access-changed'))
            },
          })
        }
        const instance = factory.current()
        const current = await instance.load()
        if (active) {
          form.reset(companySetupDefaults(current))
          setRevision(current.revision)
          setCoordinator(instance)
        }
      } catch (error) {
        if (active) setState({ pending: false, error, uncertain: false })
      }
    }
    void initialize()
    return () => {
      active = false
      controller.abort()
    }
    // Load once per actor; form.reset fills fields from the server.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorId])

  const busy =
    isSubmitting ||
    mutation.pending ||
    mutation.uncertain ||
    completion.pending ||
    completion.uncertain ||
    redirectingToPayment
  const locked = readOnly || !coordinator || busy

  async function onSave(values) {
    if (!coordinator || readOnly || redirectingToPayment) return
    setState({ pending: true, error: null, uncertain: false })
    try {
      coordinator.edit(companySetupPayload(values))
      const result = await coordinator.save()
      setRevision(result.revision)
      setSavedRevision(true)
      form.reset(values)
      setState({ pending: false, error: null, uncertain: false })
    } catch (error) {
      setState({ pending: false, error, uncertain: false })
    }
  }

  async function finish() {
    if (!coordinator || readOnly || redirectingToPayment) return
    const valid = await form.trigger()
    if (!valid) return
    if (paymentPreview && !paymentAccepted && !completion.uncertain) return
    setState({ pending: true, error: null, uncertain: false })
    try {
      const values = form.getValues()
      if (!state.uncertain) coordinator.edit(companySetupPayload(values))
      const journey = await coordinator.finish()
      form.reset(values)
      const paymentRequest =
        applicationId &&
        subjectId.current &&
        (paymentAccepted || resumeCheckout)
          ? {
              applicationId,
              subjectId: subjectId.current,
              kind: paymentAccepted ? 'checkout' : 'recover',
              body: paymentAccepted ? paymentBody : null,
            }
          : null
      if (paymentRequest) setRedirectingToPayment(true)
      else setState({ pending: false, error: null, uncertain: false })
      if (['open_workspace', 'choose_workspace'].includes(journey.nextAction))
        navigate('/app')
      else saved(journey, paymentRequest)
    } catch (error) {
      setRedirectingToPayment(false)
      setState({
        pending: false,
        error,
        uncertain: !error.status || error.status >= 500,
      })
    }
  }

  function setGeography(patch) {
    clearApiError()
    for (const [key, value] of Object.entries(patch)) {
      form.setValue(key, value, {
        shouldDirty: true,
        shouldValidate: form.formState.isSubmitted,
      })
    }
    setSavedRevision(false)
  }

  const { errors } = form.formState
  const conflictError =
    state.error?.status === 409 &&
    /VERSION_CONFLICT|SETUP_CHANGED/.test(state.error.code || '')
      ? state.error
      : null
  const formError = conflictError ? null : state.error

  return (
    <div className="company-setup-form w-full space-y-lg">
      <p className="muted m-0 max-w-form">
        Your workspace is managed by BookMySku. Add your business address and
        industry below.
      </p>
      {readOnly && (
        <p className="notice m-0">
          Company setup is now locked. Your entered details are preserved below
          for review; saving and completion are paused.
        </p>
      )}
      <FormApiAlert error={formError} />
      <AppFormProvider
        form={form}
        onSubmit={onSave}
        animated={false}
        className="company-setup-card w-full space-y-md"
      >
        <fieldset
          disabled={locked}
          className="m-0 min-w-0 space-y-md border-0 p-0"
        >
          <FormTextField
            name="industry"
            label="Industry"
            maxLength={100}
            required
          />
          <FormTextField
            name="line1"
            label="Address line 1"
            maxLength={160}
            required
          />
          <FormTextField
            name="line2"
            label="Address line 2 (optional)"
            maxLength={160}
          />
          <div className="form-grid">
            <FormTextField
              name="city"
              label="City"
              maxLength={100}
              required
            />
            <FormTextField
              name="postalCode"
              label="Postal code"
              maxLength={24}
              required
            />
          </div>
          <div className="form-grid">
            <GeographyFields
              values={geographyValues}
              change={setGeography}
              errors={{
                country: errors.country?.message,
                stateCode: errors.stateCode?.message,
              }}
            />
          </div>
        </fieldset>
        <div className="company-setup-actions">
          <FormSubmitButton
            pendingLabel="Saving…"
            disabled={
              readOnly ||
              !coordinator ||
              completion.pending ||
              completion.uncertain ||
              redirectingToPayment
            }
            className="company-setup-submit w-auto"
          >
            Save company details
          </FormSubmitButton>
        </div>
      </AppFormProvider>
      <ConflictReview
        error={conflictError}
        path="/onboarding/setup"
        values={companySetupPayload(form.getValues())}
        onReview={async (current) => {
          try {
            const instance = factory.current(current)
            await instance.load()
            setCoordinator(instance)
            setRevision(current.revision)
            form.reset(companySetupDefaults(current))
            setState({ pending: false, error: null, uncertain: false })
          } catch (error) {
            setState({
              pending: false,
              error,
              uncertain: !error.status || error.status >= 500,
            })
          }
        }}
      />
      <p className="muted m-0 text-xs">Saved revision {revision}</p>
      {paymentPreview && (
        <section
          className="company-setup-card w-full space-y-md"
          aria-label="Billing terms before continuing"
        >
          <div className="space-y-xs">
            <h3 className="m-0">Review your billing terms</h3>
            <p className="muted m-0">
              After your company details are completed, your secure Stripe page
              will open automatically. Subscription start remains a separate
              confirmation.
            </p>
          </div>
          <CheckoutTerms
            preview={paymentPreview}
            checked={paymentAccepted}
            change={(checked) => {
              clearApiError()
              setAcceptedPayment(checked ? paymentKey : '')
            }}
            disabled={locked}
          />
        </section>
      )}
      {coordinator && (
        <div className="company-setup-card company-setup-card-muted w-full space-y-md">
          <p className="m-0">
            {savedRevision ? 'Details saved. ' : ''}
            {paymentPreview || resumeCheckout
              ? 'Finish completes your company details and opens your secure Stripe page automatically when ready.'
              : 'Finish saves and completes these details, then checks the next workspace step. Subscription consent remains separate.'}
          </p>
          <Action
            disabled={
              readOnly ||
              isSubmitting ||
              mutation.pending ||
              completion.pending ||
              redirectingToPayment ||
              (paymentPreview && !paymentAccepted && !completion.uncertain)
            }
            onClick={finish}
          >
            {redirectingToPayment
              ? 'Redirecting to payment…'
              : completion.pending
                ? paymentPreview || resumeCheckout
                  ? 'Redirecting to payment…'
                  : 'Completing…'
                : completion.uncertain
                  ? 'Retry completion'
                  : paymentPreview || resumeCheckout
                    ? 'Finish setup and continue to payment'
                    : 'Finish setup'}
          </Action>
        </div>
      )}
    </div>
  )
}
