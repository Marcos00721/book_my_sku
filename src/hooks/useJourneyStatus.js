import { useEffect, useRef } from 'react'
import { useResource } from './useResource'

const waiting = new Set([
  'await_review',
  'await_offer',
  'wait_billing',
  'wait_provisioning',
  'wait_registration',
])

export function useJourneyStatus() {
  const resource = useResource('/onboarding/journey')
  const attempts = useRef(0)
  const reload = resource.reload
  useEffect(() => {
    if (
      !resource.data?.actorId ||
      !waiting.has(resource.data.nextAction) ||
      attempts.current >= 6 ||
      !navigator.locks
    )
      return
    let timer
    let canceled = false
    let release
    void navigator.locks.request(
      `bookmysku:journey:${resource.data.actorId}`,
      { ifAvailable: true },
      async (lock) => {
        if (!lock || canceled) return
        const suggested =
          Date.parse(resource.data.retryAfter || '') - Date.now()
        const delay =
          Math.max(
            60000,
            Math.min(300000, 60000 * 2 ** attempts.current),
            Number.isFinite(suggested) ? suggested : 0,
          ) +
          Math.random() * 3000
        await new Promise((resolve) => {
          release = resolve
          timer = setTimeout(resolve, delay)
        })
        if (!canceled && document.visibilityState === 'visible') {
          attempts.current++
          reload()
        }
      },
    )
    return () => {
      canceled = true
      clearTimeout(timer)
      release?.()
    }
  }, [resource.data, reload])
  return resource
}
