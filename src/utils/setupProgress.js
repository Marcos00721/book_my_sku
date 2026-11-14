export function setupStepFromJourney(journey, { editing = false } = {}) {
  const setup = journey?.setup
  if (!setup || !setup.complete || editing) return 'company'

  // A support or preparation action does not establish payment completion.
  return journey?.billing?.billingEligible === true ? 'workspace' : 'payment'
}
