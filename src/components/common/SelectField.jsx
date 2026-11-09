import {
  Children,
  forwardRef,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'
import { theme } from '@/crm-theme'
import { FieldFrame } from './FieldFrame'

const PANEL_HEIGHT = 260

function optionLabel(node) {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(optionLabel).join('')
  if (isValidElement(node)) return optionLabel(node.props.children)
  return ''
}

function optionsFromChildren(children) {
  const list = []
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    if (child.type === 'option') {
      list.push({
        value: String(child.props.value ?? ''),
        label:
          optionLabel(child.props.children) || String(child.props.value ?? ''),
        disabled: Boolean(child.props.disabled),
      })
      return
    }
    if (child.props?.children)
      list.push(...optionsFromChildren(child.props.children))
  })
  return list
}

function emitChange(onChange, name, value) {
  if (!onChange) return
  onChange({
    target: { name, value },
    currentTarget: { name, value },
  })
}

function scrollOptionIntoList(listEl, index) {
  const option = listEl?.querySelector(`[data-index="${index}"]`)
  if (!listEl || !option) return
  const top = option.offsetTop
  const bottom = top + option.offsetHeight
  if (top < listEl.scrollTop) listEl.scrollTop = top
  else if (bottom > listEl.scrollTop + listEl.clientHeight) {
    listEl.scrollTop = bottom - listEl.clientHeight
  }
}

/**
 * Custom select — fixed-height glass panel, in-panel search, no page scroll.
 */
export const SelectField = forwardRef(function SelectField(
  {
    label,
    hint,
    error,
    required = false,
    id,
    name,
    className = '',
    controlClassName = '',
    disabled = false,
    children,
    options: optionsProp,
    value,
    defaultValue,
    onChange,
    onBlur,
    placeholder,
    searchable = true,
    searchPlaceholder = 'Search…',
    ...props
  },
  ref,
) {
  const listId = useId()
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const panelRef = useRef(null)
  const optionsRef = useRef(null)
  const searchRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [query, setQuery] = useState('')
  const [uncontrolled, setUncontrolled] = useState(
    () => value ?? defaultValue ?? '',
  )
  const isControlled = value !== undefined
  const selectedValue = String(isControlled ? value ?? '' : uncontrolled)

  const options = useMemo(
    () =>
      optionsProp?.length
        ? optionsProp.map((item) => ({
            value: String(item.value ?? ''),
            label: String(item.label ?? item.value ?? ''),
            disabled: Boolean(item.disabled),
          }))
        : optionsFromChildren(children),
    [optionsProp, children],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((item) => item.label.toLowerCase().includes(q))
  }, [options, query])

  const selected = options.find((item) => item.value === selectedValue)
  const display =
    selected?.label ||
    placeholder ||
    options.find((item) => item.value === '')?.label ||
    'Select…'
  const showPlaceholder = !selected || selected.value === ''

  function setRefs(node) {
    buttonRef.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }

  function updateCoords() {
    const node = buttonRef.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const gap = 6
    const spaceBelow = window.innerHeight - rect.bottom - gap
    const spaceAbove = rect.top - gap
    const openUp = spaceBelow < PANEL_HEIGHT && spaceAbove > spaceBelow
    const height = Math.min(
      PANEL_HEIGHT,
      Math.max(160, openUp ? spaceAbove : spaceBelow),
    )
    setCoords({
      left: rect.left,
      width: Math.max(rect.width, 180),
      height,
      top: openUp ? rect.top - gap - height : rect.bottom + gap,
    })
  }

  function openMenu() {
    if (disabled) return
    setQuery('')
    updateCoords()
    const index = Math.max(
      0,
      options.findIndex(
        (item) => item.value === selectedValue && !item.disabled,
      ),
    )
    setActiveIndex(index)
    setOpen(true)
  }

  function closeMenu(focusTrigger = true) {
    setOpen(false)
    setQuery('')
    setActiveIndex(-1)
    if (focusTrigger) buttonRef.current?.focus()
  }

  function pick(option) {
    if (option.disabled) return
    if (!isControlled) setUncontrolled(option.value)
    emitChange(onChange, name, option.value)
    closeMenu()
  }

  useLayoutEffect(() => {
    if (!open) return
    updateCoords()
    const onScroll = (event) => {
      if (panelRef.current?.contains(event.target)) return
      updateCoords()
    }
    window.addEventListener('resize', updateCoords)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('resize', updateCoords)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    if (searchable) searchRef.current?.focus()
    function onPointer(event) {
      if (rootRef.current?.contains(event.target)) return
      if (panelRef.current?.contains(event.target)) return
      closeMenu(false)
    }
    function onKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeMenu()
      }
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, searchable])

  useEffect(() => {
    if (!open) return
    setActiveIndex((current) => {
      if (!filtered.length) return -1
      if (current >= 0 && filtered[current] && !filtered[current].disabled)
        return current
      return filtered.findIndex((item) => !item.disabled)
    })
  }, [query, open, filtered])

  useEffect(() => {
    if (!open || activeIndex < 0) return
    scrollOptionIntoList(optionsRef.current, activeIndex)
  }, [open, activeIndex, filtered])

  function moveActive(direction) {
    setActiveIndex((current) => {
      if (!filtered.length) return -1
      let next = current < 0 ? (direction > 0 ? -1 : 0) : current
      for (let i = 0; i < filtered.length; i += 1) {
        next =
          direction > 0
            ? next >= filtered.length - 1
              ? 0
              : next + 1
            : next <= 0
              ? filtered.length - 1
              : next - 1
        if (!filtered[next]?.disabled) return next
      }
      return current
    })
  }

  function onListKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveActive(1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveActive(-1)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (filtered[activeIndex]) pick(filtered[activeIndex])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      closeMenu()
    }
  }

  function onTriggerKeyDown(event) {
    if (disabled) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) openMenu()
      else moveActive(event.key === 'ArrowDown' ? 1 : -1)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!open) openMenu()
      else if (filtered[activeIndex]) pick(filtered[activeIndex])
    }
  }

  const menu =
    open && coords
      ? createPortal(
          <div
            ref={panelRef}
            id={listId}
            className={theme.dropdown.panel}
            style={{
              position: 'fixed',
              left: coords.left,
              width: coords.width,
              top: coords.top,
              height: coords.height,
            }}
            onWheel={(event) => event.stopPropagation()}
          >
            {searchable ? (
              <div className={theme.dropdown.searchWrap}>
                <Search
                  aria-hidden="true"
                  className="size-icon shrink-0 text-text-muted"
                />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  className={theme.dropdown.searchInput}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={onListKeyDown}
                />
              </div>
            ) : null}
            <ul
              ref={optionsRef}
              role="listbox"
              className={theme.dropdown.list}
            >
              {filtered.length === 0 ? (
                <li className="px-md py-sm text-sm text-text-muted">
                  No matches
                </li>
              ) : (
                filtered.map((option, index) => {
                  const isSelected = option.value === selectedValue
                  const isActive = index === activeIndex
                  return (
                    <li key={`${option.value}-${index}`} role="presentation">
                      <button
                        type="button"
                        role="option"
                        data-index={index}
                        aria-selected={isSelected}
                        disabled={option.disabled}
                        className={theme.cx(
                          theme.dropdown.option,
                          isActive && theme.dropdown.optionHover,
                          isSelected && theme.dropdown.optionSelected,
                          option.disabled && theme.dropdown.optionDisabled,
                        )}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => pick(option)}
                      >
                        <span className="min-w-0 truncate">{option.label}</span>
                        {isSelected ? (
                          <Check
                            className="size-icon shrink-0"
                            aria-hidden="true"
                          />
                        ) : null}
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </div>,
          document.body,
        )
      : null

  return (
    <FieldFrame
      id={id}
      label={label}
      required={required}
      hint={hint}
      error={error}
      className={className}
    >
      {({ id: fieldId, describedBy, invalid }) => (
        <div ref={rootRef} className="relative isolate">
          <input
            type="hidden"
            name={name}
            value={selectedValue}
            required={required}
          />
          <button
            {...props}
            ref={setRefs}
            id={fieldId}
            type="button"
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            aria-required={required || undefined}
            className={theme.cx(
              theme.select,
              invalid && theme.inputInvalid,
              controlClassName,
            )}
            onClick={() => (open ? closeMenu() : openMenu())}
            onKeyDown={onTriggerKeyDown}
            onBlur={onBlur}
          >
            <span
              className={theme.cx(
                'min-w-0 flex-1 truncate',
                showPlaceholder && theme.dropdown.placeholder,
              )}
            >
              {display}
            </span>
            <ChevronDown
              aria-hidden="true"
              className={theme.cx(
                'size-icon shrink-0 text-text-muted motion-safe:transition-transform',
                open && 'rotate-180',
              )}
            />
          </button>
          {menu}
        </div>
      )}
    </FieldFrame>
  )
})