import { useEffect, useRef, useState } from 'react'
import { loadReferenceEntries, planReferenceMove } from '../services/referenceLists'
import { mutate } from '../services/workspace'
import { useDraftGuard } from './useDraftGuard'

export function useReferenceOrdering({ base, items, enabled, reload, refresh }) {
  const job = useRef(null)
  const running = useRef(false)
  const mounted = useRef(true)
  const controller = useRef(null)
  const [state, setState] = useState({ phase: 'idle', error: null, ordered: null, completed: 0, total: 0, message: '' })
  const locked = state.phase !== 'idle'
  useDraftGuard(locked)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      controller.current?.abort()
    }
  }, [])

  async function save() {
    const current = job.current
    for (; current.index < current.updates.length; current.index++) {
      if (!mounted.current) return
      const { id, ...payload } = current.updates[current.index]
      // mutate retains the same operation key for an interrupted position save.
      await mutate('patch', `${base}/${id}`, payload)
      if (!mounted.current) return
      setState((value) => ({ ...value, completed: current.index + 1 }))
      // Large legacy lists may start with identical positions. Pace their
      // normalization within the reference API's shared request allowance.
      if (current.updates.length > 30 && current.index < current.updates.length - 1)
        await new Promise((resolve) => setTimeout(resolve, 1100))
    }
    if (!mounted.current) return
    await refresh()
    job.current = null
    if (mounted.current) {
      setState({ phase: 'idle', error: null, ordered: null, completed: 0, total: 0, message: 'Order saved.' })
    }
  }

  async function move(fromId, toId) {
    if (!enabled || running.current || locked || fromId === toId) return
    running.current = true
    setState({ phase: 'saving', error: null, ordered: null, completed: 0, total: 0, message: 'Saving order…' })
    controller.current = new AbortController()
    try {
      const current = await loadReferenceEntries(base, { signal: controller.current.signal })
      for (const id of [fromId, toId]) {
        if (current.find((item) => item.id === id)?.revision !== items.find((item) => item.id === id)?.revision)
          throw new Error('This list changed. Reload it before reordering.')
      }
      const plan = planReferenceMove(current, fromId, toId)
      job.current = { updates: plan.updates, index: 0 }
      const visible = new Set(items.map((item) => item.id))
      setState((value) => ({ ...value, ordered: plan.items.filter((item) => visible.has(item.id)), total: plan.updates.length }))
      await save()
    } catch (error) {
      if (mounted.current) setState((value) => ({ ...value, phase: 'failed', error, message: '' }))
    } finally {
      running.current = false
    }
  }

  async function retry() {
    if (!job.current || running.current) return
    running.current = true
    setState((value) => ({ ...value, phase: 'saving', error: null }))
    try {
      await save()
    } catch (error) {
      if (mounted.current) setState((value) => ({ ...value, phase: 'failed', error }))
    } finally {
      running.current = false
    }
  }

  const uncertain = Boolean(state.error && job.current &&
    (!state.error.status || state.error.status >= 500 || state.error.status === 429))
  return {
    ...state,
    locked,
    uncertain,
    items: state.ordered || items,
    move,
    retry,
    reset() {
      job.current = null
      setState({ phase: 'idle', error: null, ordered: null, completed: 0, total: 0, message: '' })
      reload()
    },
  }
}
