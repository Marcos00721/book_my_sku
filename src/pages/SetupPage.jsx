import { useCallback, useEffect, useRef, useState } from "react";
import { useDraftGuard } from "../hooks/useDraftGuard";
import { useJourneyStatus } from "../hooks/useJourneyStatus";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { getAuthClient } from "../services/auth";
import { createOnboardingCoordinator } from "../services/onboardingCoordinator";
import { ConflictReview } from "../components/workspace/RecordTools";
import { Link, Navigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { BrandMark } from "../components/auth/BrandMark";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { BillingPanel } from "../components/workspace/BillingPanel";
import { GeographyFields } from "../components/workspace/GeographyFields";
import { CheckoutTerms } from "../components/workspace/CheckoutTerms";
import { PaymentHandoff } from "../components/workspace/PaymentHandoff";
import {
  Action,
  ErrorNotice,
  Field,
  Loading,
  PageHeader,
  SaveFooter,
  Status,
} from "../components/workspace/Elements";
import { useMutation } from "../hooks/useMutation";

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
          <Link className="button secondary" to="/app">
            Workspace
          </Link>
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
      <SetupGuidance
        current={current}
        reload={journey.reload}
        exhausted={journey.pollingExhausted}
      />
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
          <Link className="button secondary" to="/assisted">
            Review assisted billing
          </Link>
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

function SetupGuidance({ current, reload, exhausted }) {
  const action = current.nextAction;
  const explicitStart = current.billing?.flowVersion === 2;
  const messages = {
    complete_company: [
      "Complete your company details",
      "Save your address and business classification, then choose Finish setup.",
    ],
    prepare_workspace: [
      "Prepare your workspace",
      "Your company details are complete. Choose Prepare workspace below. Card setup and subscription start follow separately.",
    ],
    review_offer: [
      "Set up your payment method",
      explicitStart
        ? "Review the offer and recurring terms below, then continue to Stripe to save your card. Your subscription starts only after your separate confirmation."
        : "Review the offer and recurring terms below, then continue to Stripe to complete your payment-method setup. Billing verification controls workspace access.",
    ],
    recover_payment: [
      "Continue your secure payment step",
      "Use Resume payment / recover below to reopen the original Stripe Checkout or invoice page.",
    ],
    refresh_billing: [
      "Verify your billing status",
      "Choose Refresh billing status below to check your saved card or payment with Stripe and load the next step.",
    ],
    review_and_start: [
      "Your card is saved. Review and start your subscription",
      "Review the accepted price and terms below, give recurring billing consent, and choose Start subscription.",
    ],
    activate_workspace: [
      "Your workspace is ready to activate",
      "Your billing is verified. Choose Activate workspace below to continue to your workspace.",
    ],
    wait_provisioning: [
      "Your workspace is being prepared",
      "Your company details are saved. Status checks will show when preparation finishes.",
    ],
    wait_billing:
      current.billing?.status === "checkout_creating"
        ? [
            "Your secure card setup is being prepared",
            "The existing Checkout request is still processing. Status checks will continue. If it remains pending, use Resume existing Checkout below when it becomes available.",
          ]
        : [
            "Your billing confirmation is processing",
            explicitStart
              ? "We are waiting for the current billing step to finish. Status checks will show when you can continue; a subscription will not start from this screen without your separate consent."
              : "We are waiting for Stripe to confirm the current billing step. Status checks will show when you can continue to workspace access.",
          ],
    await_offer: [
      "Your offer is being prepared",
      "Your company details are saved. Your agreed billing offer will appear here when it is ready.",
    ],
    contact_support: [
      "Your workspace needs a support review",
      "Keep your existing company and billing details. Contact support with any request reference shown below.",
    ],
    open_workspace: [
      "Your workspace is active",
      "Your company and billing checklist is available below.",
    ],
    prepare_assisted_workspace: [
      "Complete your assisted setup",
      "Follow your accepted agreement and company checklist below.",
    ],
  };
  const [title, description] = messages[action] || [
    "Check your setup progress",
    "Check the current status to load your next available step.",
  ];
  return (
    <section className="panel" aria-label="Next onboarding step">
      <h2>{title}</h2>
      <p>{description}</p>
      {current.billing?.flowVersion === 2 && (
        <p className="muted">
          Your flow: company details → prepared workspace → card setup → review
          and Start subscription → workspace access.
        </p>
      )}
      {exhausted && (
        <p className="notice">
          Automatic checks have paused after several attempts. Check the current
          status manually, or contact support if billing remains pending.
        </p>
      )}
      <Action variant="secondary" onClick={reload}>
        Check current status
      </Action>
    </section>
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
  const [values, setValues] = useState({
    industry: setup.industry || "",
    asiNumber: setup.asiNumber || "",
    ...Object.fromEntries(
      [
        "line1",
        "line2",
        "city",
        "region",
        "postalCode",
        "country",
        "stateCode",
      ].map((key) => [key, setup.address?.[key] || ""]),
    ),
  });
  const [revision, setRevision] = useState(setup.revision);
  const [savedRevision, setSavedRevision] = useState(setup.revision > 0);
  const [edited, setEdited] = useState(false);
  useDraftGuard(edited);
  const [coordinator, setCoordinator] = useState(null);
  const factory = useRef(null);
  const initialSetup = useRef(setup);
  const subjectId = useRef(null);
  const [acceptedPayment, setAcceptedPayment] = useState("");
  const paymentBody = paymentPreview
    ? {
        expectedOfferRevision: paymentPreview.offer.revision,
        recurringConsent: true,
        termsVersion: paymentPreview.consent.termsVersion,
      }
    : null;
  const paymentKey = paymentBody
    ? JSON.stringify([applicationId, paymentBody])
    : "";
  const paymentAccepted = Boolean(paymentKey && paymentKey === acceptedPayment);
  const [state, setState] = useState({
    pending: false,
    error: null,
    uncertain: false,
  });
  const navigate = useNavigate();
  const mutation = state;
  const completion = state;
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function initialize() {
      try {
        const { data } = await getAuthClient().auth.getSession();
        const subject = data.session?.user.id;
        if (!active) return;
        if (!actorId || !subject)
          throw new Error(
            "Your setup identity could not be confirmed. Reload your session.",
          );
        subjectId.current = subject;
        factory.current = (reviewed) => {
          let seed = reviewed;
          const baseline = reviewed || initialSetup.current;
          return createOnboardingCoordinator({
            allowCompletedEdits: baseline.complete && !baseline.locked,
            actorId,
            currentActorId: () => (active ? actorId : null),
            withLock: async (name, task) => {
              if (!navigator.locks)
                throw new Error(
                  "This browser cannot coordinate setup across tabs. Use a browser with Web Locks support.",
                );
              return navigator.locks.request(name, task);
            },
            request: async (method, path, body) => {
              const current = await getAuthClient().auth.getSession();
              if (!active || current.data.session?.user.id !== subject)
                throw new Error(
                  "Your account changed. Reload setup before continuing.",
                );
              // Opening the editor reads setup from the API. Only an explicit
              // conflict review can seed a read already performed for that review.
              if (method === "GET" && path === "/onboarding/setup" && seed) {
                const result = seed;
                seed = null;
                return result;
              }
              const options = { signal: controller.signal };
              return (
                await (method === "GET"
                  ? api.get(path, options)
                  : api[method.toLowerCase()](path, body, options))
              ).data;
            },
            refreshPermissions: async (workspaces) => {
              for (const org of workspaces.items.filter(
                (item) => item.status === "active",
              ))
                await Promise.all([
                  api.get(`/organizations/${org.id}/permissions`, {
                    signal: controller.signal,
                  }),
                  api.get(`/organizations/${org.id}/access`, {
                    signal: controller.signal,
                  }),
                ]);
              window.dispatchEvent(new Event("workspace-access-changed"));
            },
          });
        };
        const instance = factory.current();
        const current = await instance.load();
        if (active) {
          setValues({
            industry: current.industry || "",
            asiNumber: current.asiNumber || "",
            ...Object.fromEntries(
              [
                "line1",
                "line2",
                "city",
                "region",
                "postalCode",
                "country",
                "stateCode",
              ].map((key) => [key, current.address?.[key] || ""]),
            ),
          });
          setRevision(current.revision);
          setCoordinator(instance);
        }
      } catch (error) {
        if (active) setState({ pending: false, error, uncertain: false });
      }
    }
    void initialize();
    return () => {
      active = false;
      controller.abort();
    };
  }, [actorId]);
  const locked =
    readOnly ||
    !coordinator ||
    mutation.pending ||
    mutation.uncertain ||
    completion.pending ||
    completion.uncertain;
  const set = (key, value) => {
    setValues((current) => ({ ...current, [key]: value }));
    setSavedRevision(false);
    setEdited(true);
  };
  const save = useCallback(
    async (event) => {
      event?.preventDefault();
      if (!coordinator || readOnly) return;
      setState({ pending: true, error: null, uncertain: false });
      try {
        coordinator.edit({
          industry: values.industry.trim(),
          asiNumber: values.asiNumber.trim(),
          address: Object.fromEntries(
            [
              "line1",
              "line2",
              "city",
              "postalCode",
              "country",
              "stateCode",
            ].map((key) => [key, values[key].trim()]),
          ),
        });
        const result = await coordinator.save();
        setRevision(result.revision);
        setSavedRevision(true);
        setEdited(false);
        setState({ pending: false, error: null, uncertain: false });
      } catch (error) {
        setState({ pending: false, error, uncertain: false });
      }
    },
    [coordinator, values, readOnly],
  );
  useEffect(() => {
    if (readOnly || !edited || !coordinator || state.pending || state.error)
      return;
    const timer = setTimeout(() => {
      void save();
    }, 1500);
    return () => clearTimeout(timer);
  }, [readOnly, edited, coordinator, state.pending, state.error, save]);
  async function finish() {
    if (!coordinator || readOnly) return;
    if (paymentPreview && !paymentAccepted && !completion.uncertain) return;
    setState({ pending: true, error: null, uncertain: false });
    try {
      if (!state.uncertain)
        coordinator.edit({
          industry: values.industry.trim(),
          asiNumber: values.asiNumber.trim(),
          address: Object.fromEntries(
            [
              "line1",
              "line2",
              "city",
              "postalCode",
              "country",
              "stateCode",
            ].map((key) => [key, values[key].trim()]),
          ),
        });
      const journey = await coordinator.finish();
      setEdited(false);
      setState({ pending: false, error: null, uncertain: false });
      if (["open_workspace", "choose_workspace"].includes(journey.nextAction))
        navigate("/app");
      else
        saved(
          journey,
          applicationId &&
            subjectId.current &&
            (paymentAccepted || resumeCheckout)
            ? {
                applicationId,
                subjectId: subjectId.current,
                kind: paymentAccepted ? "checkout" : "recover",
                body: paymentAccepted ? paymentBody : null,
              }
            : null,
        );
    } catch (error) {
      setState({
        pending: false,
        error,
        uncertain: !error.status || error.status >= 500,
      });
    }
  }
  return (
    <>
      <p className="muted">
        Your workspace is managed by BookMySku. Add your business address and
        industry below.
      </p>
      {readOnly && (
        <p className="notice">
          Company setup is now locked. Your entered details are preserved below
          for review; saving and completion are paused.
        </p>
      )}
      <form onSubmit={save}>
        <fieldset disabled={locked}>
          <div className="form-grid">
            <Field
              label="Industry"
              value={values.industry}
              maxLength={100}
              onChange={(event) => set("industry", event.target.value)}
            />
            <Field
              label="ASI number (optional)"
              value={values.asiNumber}
              maxLength={40}
              onChange={(event) => set("asiNumber", event.target.value)}
            />
          </div>
          {[
            ["line1", "Address line 1"],
            ["line2", "Address line 2 (optional)"],
          ].map(([key, label]) => (
            <Field
              key={key}
              label={label}
              maxLength={160}
              value={values[key]}
              onChange={(event) => set(key, event.target.value)}
            />
          ))}
          <div className="form-grid">
            {[
              ["city", "City"],
              ["postalCode", "Postal code"],
            ].map(([key, label]) => (
              <Field
                key={key}
                label={label}
                maxLength={
                  key === "country" ? 2 : key === "postalCode" ? 24 : 100
                }
                value={values[key]}
                onChange={(event) =>
                  set(
                    key,
                    key === "country"
                      ? event.target.value.toUpperCase()
                      : event.target.value,
                  )
                }
              />
            ))}
            <GeographyFields
              values={values}
              change={(patch) => {
                setValues((current) => ({ ...current, ...patch }));
                setSavedRevision(false);
                setEdited(true);
              }}
            />
          </div>
        </fieldset>
        <SaveFooter
          mutation={mutation}
          label="Save company details"
          disabled={
            readOnly ||
            !coordinator ||
            completion.pending ||
            completion.uncertain
          }
        />
      </form>
      <ErrorNotice error={completion.error} />
      {state.error && (
        <p className="notice">
          Your entered details are preserved. Review the latest setup before
          retrying. Support reference:{" "}
          {state.error.requestId || state.error.code || "unavailable"}
        </p>
      )}
      <ConflictReview
        error={state.error}
        path="/onboarding/setup"
        values={{
          industry: values.industry,
          asiNumber: values.asiNumber,
          address: Object.fromEntries(
            [
              "line1",
              "line2",
              "city",
              "postalCode",
              "country",
              "stateCode",
            ].map((key) => [key, values[key]]),
          ),
        }}
        onReview={async (current) => {
          try {
            const instance = factory.current(current);
            await instance.load();
            setCoordinator(instance);
            setRevision(current.revision);
            setState({ pending: false, error: null, uncertain: false });
          } catch (error) {
            setState({
              pending: false,
              error,
              uncertain: !error.status || error.status >= 500,
            });
          }
        }}
      />
      <small className="muted">Saved revision {revision}</small>
      {paymentPreview && (
        <section className="panel" aria-label="Billing terms before continuing">
          <h3>Review your billing terms</h3>
          <p>
            After your company details are completed, your secure Stripe page
            will open automatically. Subscription start remains a separate
            confirmation.
          </p>
          <CheckoutTerms
            preview={paymentPreview}
            checked={paymentAccepted}
            change={(checked) => setAcceptedPayment(checked ? paymentKey : "")}
            disabled={locked}
          />
        </section>
      )}
      {coordinator && (
        <div className="notice">
          <div>
            <p>
              {savedRevision ? "Details saved. " : ""}
              {paymentPreview || resumeCheckout
                ? "Finish completes your company details and opens your secure Stripe page automatically when ready."
                : "Finish saves and completes these details, then checks the next workspace step. Subscription consent remains separate."}
            </p>
            <Action
              disabled={
                readOnly ||
                mutation.pending ||
                completion.pending ||
                (paymentPreview && !paymentAccepted && !completion.uncertain)
              }
              onClick={finish}
            >
              {completion.pending
                ? "Completing…"
                : completion.uncertain
                  ? "Retry completion"
                  : paymentPreview || resumeCheckout
                    ? "Finish setup and continue to payment"
                    : "Finish setup"}
            </Action>
          </div>
        </div>
      )}
    </>
  );
}
