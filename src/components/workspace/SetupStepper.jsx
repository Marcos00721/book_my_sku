const STEPS = [
  { id: 'company', label: 'Company details' },
  { id: 'payment', label: 'Payment' },
  { id: 'workspace', label: 'Workspace' },
]

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
