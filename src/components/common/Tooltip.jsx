import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/** A themed tooltip without a wrapper that could change its trigger's layout. */
export function Tooltip({ content, children }) {
  const id = useId()
  const tipRef = useRef(null)
  const timer = useRef(null)
  const hovered = useRef(false)
  const focused = useRef(false)
  const [anchor, setAnchor] = useState(null)
  const [open, setOpen] = useState(false)

  function cancelTimer() {
    clearTimeout(timer.current)
  }

  function show(element, immediate = false) {
    cancelTimer()
    setAnchor(element)
    if (immediate) setOpen(true)
    else timer.current = setTimeout(() => setOpen(true), 350)
  }

  function leave() {
    cancelTimer()
    if (!focused.current) timer.current = setTimeout(() => setOpen(false), 120)
  }

  useEffect(() => () => clearTimeout(timer.current), [])

  useLayoutEffect(() => {
    if (!open || !anchor || !content) return
    const tip = tipRef.current
    // The top layer keeps hints above native dialogs and out of clipped panels.
    tip.showPopover?.()
    const rect = anchor.getBoundingClientRect()
    const { width, height } = tip.getBoundingClientRect()
    const gap = 10
    const margin = 10
    const below = rect.top < height + gap + margin
    const left = Math.max(margin, Math.min(
      rect.left + rect.width / 2 - width / 2,
      window.innerWidth - width - margin,
    ))
    const top = Math.max(margin, Math.min(
      below ? rect.bottom + gap : rect.top - height - gap,
      window.innerHeight - height - margin,
    ))
    tip.style.left = `${left}px`
    tip.style.top = `${top}px`
    return () => {
      if (tip.isConnected) tip.hidePopover?.()
    }
  }, [open, anchor, content])

  useEffect(() => {
    if (!open || !content) return
    function dismiss() {
      clearTimeout(timer.current)
      setOpen(false)
    }
    function escape(event) {
      if (event.key !== 'Escape') return
      // Dismissing a hint must not also dismiss its containing dialog.
      event.preventDefault()
      event.stopPropagation()
      dismiss()
    }
    function scroll(event) {
      if (!tipRef.current?.contains(event.target)) dismiss()
    }
    document.addEventListener('keydown', escape, true)
    document.addEventListener('pointerdown', dismiss, true)
    document.addEventListener('scroll', scroll, true)
    window.addEventListener('resize', dismiss)
    window.addEventListener('blur', dismiss)
    return () => {
      document.removeEventListener('keydown', escape, true)
      document.removeEventListener('pointerdown', dismiss, true)
      document.removeEventListener('scroll', scroll, true)
      window.removeEventListener('resize', dismiss)
      window.removeEventListener('blur', dismiss)
    }
  }, [open, content])

  if (!content) return children

  const props = children.props
  const Trigger = children.type
  const staticText = typeof children.type === 'string'
    && ['span', 'div', 'p', 'small', 'li', 'dd'].includes(children.type)
  const trigger = <Trigger
    {...props}
    title={undefined}
    aria-describedby={[props['aria-describedby'], id].filter(Boolean).join(' ')}
    tabIndex={props.tabIndex ?? (staticText ? 0 : undefined)}
    onPointerEnter={(event) => {
      props.onPointerEnter?.(event)
      if (event.pointerType === 'touch') return
      hovered.current = true
      show(event.currentTarget)
    }}
    onPointerLeave={(event) => {
      props.onPointerLeave?.(event)
      hovered.current = false
      leave()
    }}
    onFocus={(event) => {
      props.onFocus?.(event)
      focused.current = true
      show(event.currentTarget, true)
    }}
    onBlur={(event) => {
      props.onBlur?.(event)
      focused.current = false
      if (!hovered.current) leave()
    }}
  />
  const tip = (
    <span
      ref={tipRef}
      id={id}
      role="tooltip"
      className="app-tooltip"
      popover="manual"
      hidden={!open}
      onPointerEnter={cancelTimer}
      onPointerLeave={leave}
    >
      {content}
    </span>
  )

  return <>{trigger}{open && anchor
    ? createPortal(tip, anchor.closest('dialog') || document.body)
    : tip}</>
}
