import { useCallback, useEffect, useRef, useState } from 'react'
import { useResource } from './useResource'

const waiting = new Set([
  'await_review',
  'await_offer',
  'wait_billing',
  'wait_provisioning',
  'wait_registration',
])

export function useJourneyStatus() {
  const resource = useResource('/onboarding/journey', {
    retainDataOnError: true,
  })
  const [polls, setPolls] = useState({ key: null, count: 0 })
  const [manualRun, setManualRun] = useState(0)
  const activeLock = useRef(Promise.resolve())
  const latest = useRef(null)
  useEffect(() => {
    latest.current = resource.data
  }, [resource.data])
  const actorId = resource.data?.actorId
  const shouldPoll = waiting.has(resource.data?.nextAction)
  const pollingKey = [
    resource.data?.actorId,
    resource.data?.nextAction,
    resource.data?.billing?.status,
    resource.data?.provisioning?.status,
    manualRun,
  ].join(':')
  const attempts = polls.key === pollingKey ? polls.count : 0
  const refresh = resource.reload
  const reload = useCallback(() => {
    setManualRun((value) => value + 1)
    refresh()
  }, [refresh])
  useEffect(() => {
    if (!actorId || !shouldPoll || !navigator.locks) return
    let timer
    let canceled = false
    let release
    // A new response can arrive before the previous lock callback has released.
    // Finish that callback before trying ifAvailable again in this same tab.
    const lockRun = activeLock.current
      .catch(() => {})
      .then(() => {
        if (canceled) return
        return navigator.locks.request(
          `bookmysku:journey:${actorId}`,
          { ifAvailable: true },
          async (lock) => {
            if (!lock || canceled) return
            // Keep ownership across responses. Reacquiring on every render can
            // lose the same tab's lock and silently stop the remaining checks.
            for (let count = 0; count < 6 && !canceled;) {
              const due =
                Date.now() +
                Math.min(300000, 60000 * 2 ** count) +
                Math.random() * 3000
              while (!canceled) {
                const suggested = Date.parse(latest.current?.retryAfter || '')
                const remaining =
                  Math.max(due, Number.isFinite(suggested) ? suggested : 0) -
                  Date.now()
                if (remaining <= 0) break
                await new Promise((resolve) => {
                  release = resolve
                  timer = setTimeout(resolve, remaining)
                })
              }
              if (!canceled && document.visibilityState === 'visible') {
                count++
                setPolls({ key: pollingKey, count })
                refresh()
              }
            }
          },
        )
      })
    activeLock.current = lockRun
    void lockRun.catch(() => {})
    return () => {
      canceled = true
      clearTimeout(timer)
      release?.()
    }
  }, [actorId, shouldPoll, refresh, pollingKey])
  return {
    ...resource,
    reload,
    pollingExhausted: waiting.has(resource.data?.nextAction) && attempts >= 6,
  }
}
