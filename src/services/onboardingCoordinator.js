// Browser-compatible reference integration. request returns response.data; withLock
// must serialize this actor across tabs (e.g. navigator.locks). No payment intent
// is invented here: Checkout/Start use the separate explicit consent controls.
export function createOnboardingCoordinator({
  actorId,
  currentActorId,
  request,
  withLock,
  refreshPermissions,
  // An explicit Edit company details action may reopen completed, unlocked
  // progress. The server clears completion on the revision-checked patch.
  allowCompletedEdits = false,
}) {
  if (!withLock)
    throw new Error('An account-scoped tab coordinator is required')
  let setup,
    draft = {},
    generation = 0,
    queue = Promise.resolve(),
    sealed = false
  const failure = (code, details = {}) =>
    Object.assign(new Error(code), { code, ...details })
  const check = () => {
    if (currentActorId() !== actorId) throw failure('ACCOUNT_CHANGED')
  }
  async function call(method, path, body) {
    check()
    const result = await request(method, path, body)
    check()
    return result
  }
  const serial = (fn) => {
    const run = queue.then(() => withLock(`bookmysku:setup:${actorId}`, fn))
    queue = run.catch(() => {})
    return run
  }
  const matches = (record, patch) =>
    Object.entries(patch).every(([key, value]) =>
      key === 'address'
        ? Object.entries(value).every(
            ([k, v]) => (record.address?.[k] ?? '') === v,
          )
        : (record[key] ?? '') === value,
    )
  async function reconcile(error, patch, revision, completed = false) {
    // Conflicts need user review, never an automatic rebase of unsaved fields.
    if (error.status && error.status < 500) throw error
    const current = await call('GET', '/onboarding/setup')
    if (
      completed
        ? current.complete
        : matches(current, patch) &&
          [revision, revision + 1].includes(current.revision)
    ) {
      setup = current
      return current
    }
    throw failure('SETUP_CHANGED', {
      server: current,
      pending: structuredClone(draft),
    })
  }
  async function transition(path) {
    try {
      await call('POST', path, {})
    } catch (error) {
      if (error.status && error.status < 500) throw error
      // A lost provider/provisioning acknowledgment is resolved by status;
      // never invent a new operation or retry the mutation in a loop.
    }
    return call('GET', '/onboarding/journey')
  }
  async function flush() {
    check()
    setup ??= await call('GET', '/onboarding/setup')
    for (let n = 0; n < 5; n++) {
      const patch = structuredClone(draft),
        version = generation
      if (!Object.keys(patch).length || matches(setup, patch)) {
        draft = {}
        return setup
      }
      if ((setup.complete && !allowCompletedEdits) || setup.locked)
        throw failure('SETUP_COMPLETED')
      const revision = setup.revision
      try {
        setup = await call('PATCH', '/onboarding/setup', {
          ...patch,
          expectedRevision: revision,
        })
      } catch (error) {
        await reconcile(error, patch, revision)
      }
      if (version === generation) {
        draft = {}
        return setup
      }
      // A newer local edit arrived during save. Retain it and serialize another save.
    }
    throw failure('EDITS_IN_PROGRESS')
  }
  return {
    edit(patch) {
      check()
      if (sealed || (setup?.complete && !allowCompletedEdits) || setup?.locked)
        throw failure('SETUP_COMPLETED')
      draft = {
        ...draft,
        ...structuredClone(patch),
        ...(patch.address
          ? { address: { ...draft.address, ...structuredClone(patch.address) } }
          : {}),
      }
      generation++
    },
    pending: () => structuredClone(draft),
    load: () =>
      serial(async () => {
        // A refresh must not silently rebase an unsaved form onto another
        // tab's newer revision. The caller can present both copies.
        if (Object.keys(draft).length)
          throw failure('UNSAVED_EDITS', {
            pending: structuredClone(draft),
          })
        setup = await call('GET', '/onboarding/setup')
        return setup
      }),
    save: () => serial(flush),
    finish: () =>
      serial(async () => {
        let state = await call('GET', '/onboarding/journey')
        if (
          state.nextAction !== 'complete_company' &&
          Object.keys(draft).length === 0 &&
          !state.setup
        )
          return state
        await flush()
        sealed = true
        try {
          if (!setup.complete) {
            const revision = setup.revision
            try {
              setup = await call('POST', '/onboarding/setup/complete', {
                expectedRevision: revision,
              })
            } catch (error) {
              await reconcile(error, {}, revision, true)
            }
          }
          state = await call('GET', '/onboarding/journey')
          // One bounded pass. Leases/payment/SCA/consent stop the pass; the UI uses
          // retryAfter with backoff, never a refresh loop or return-URL flag.
          if (state.nextAction === 'prepare_workspace')
            state = await transition('/onboarding/setup/prepare')
          if (state.nextAction === 'refresh_billing')
            state = await transition(
              `/applications/${state.application.id}/billing/refresh`,
            )
          if (state.nextAction === 'activate_workspace')
            state = await transition('/onboarding/activate')
          if (
            ['open_workspace', 'choose_workspace'].includes(state.nextAction)
          ) {
            const workspaces = await call('GET', '/organizations')
            check()
            await refreshPermissions(workspaces)
            check()
          }
          return state
        } finally {
          sealed = Boolean(setup?.complete || setup?.locked)
        }
      }),
  }
}
