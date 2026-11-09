const STEPS = [
  { id: 'company', label: 'Company details' },
  { id: 'payment', label: 'Payment' },
  { id: 'workspace', label: 'Workspace' },
]

export function setupStepFromJourney(journey, { editing = false } = {}) {
  const setup = journey?.setup
  const action = journey?.nextAction
  if (!setup || !setup.complete || editing) return 'company'

  if (
    [
      'review_offer',
      'recover_payment',
      'wait_billing',
      'review_and_start',
      'refresh_billing',
    ].includes(action) ||
    ['checkout_creating', 'checkout_pending', 'requires_action'].includes(
      journey?.billing?.status,
    )
  )
    return 'payment'

  return 'workspace'
}

export function SetupStepper({ current, completedThrough }) {
  const activeIndex = Math.max(
    0,
    STEPS.findIndex((step) => step.id === current),
  )
  const doneThrough = completedThrough
    ? Math.max(
        0,
        STEPS.findIndex((step) => step.id === completedThrough),
      )
    : activeIndex - 1

  return (
    <nav className="setup-stepper" aria-label="Setup progress">
      <ol className="setup-stepper-list">
        {STEPS.map((step, index) => {
          const done = index <= doneThrough
          const active = index === activeIndex
          return (
            <li
              key={step.id}
              className={[
                'setup-stepper-item',
                active ? 'is-active' : '',
                done ? 'is-done' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-current={active ? 'step' : undefined}
            >
              <span className="setup-stepper-index" aria-hidden="true">
                {done && !active ? '✓' : index + 1}
              </span>
              <span className="setup-stepper-label">{step.label}</span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export { STEPS as SETUP_STEPS }
