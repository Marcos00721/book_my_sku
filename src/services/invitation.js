let pending

export function captureInvitation() {
  if (window.location.hash) {
    const values = new URLSearchParams(window.location.hash.slice(1))
    const organizationId = values.get('organizationId')
    const invitationId = values.get('invitationId')
    const token = values.get('token')
    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname,
    )
    pending =
      /^[a-f\d]{24}$/i.test(organizationId || '') &&
      /^[a-f\d]{24}$/i.test(invitationId || '') &&
      token
        ? { organizationId, invitationId, token }
        : null
  }
  return pending
}
export function hasPendingInvitation() {
  return Boolean(pending)
}
export function clearInvitation() {
  pending = null
}
