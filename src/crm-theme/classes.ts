/**
 * Reusable Tailwind class strings. Components should import these instead of
 * inventing one-off color utilities.
 */

const focus =
  'focus-visible:shadow-focus focus-visible:outline-none'
const transition = 'motion-safe:transition-colors'
const disabled = 'disabled:pointer-events-none disabled:opacity-50'

export const button = {
  base: `inline-flex min-h-[34px] cursor-pointer items-center justify-center gap-xs rounded-control px-md text-sm font-semibold ${transition} ${focus} ${disabled}`,
  primary: `inline-flex min-h-[34px] cursor-pointer items-center justify-center gap-xs rounded-control bg-primary px-md text-sm font-semibold text-on-primary shadow-subtle hover:bg-primary-hover hover:shadow-card active:shadow-xs ${transition} ${focus} ${disabled}`,
  secondary: `inline-flex min-h-[34px] cursor-pointer items-center justify-center gap-xs rounded-control border border-border-control bg-surface px-md text-sm font-semibold text-text-base shadow-xs hover:border-primary hover:bg-surface-muted hover:text-primary ${transition} ${focus} ${disabled}`,
  danger: `inline-flex min-h-[34px] cursor-pointer items-center justify-center gap-xs rounded-control bg-danger px-md text-sm font-semibold text-on-primary shadow-subtle hover:shadow-card active:shadow-xs ${transition} ${focus} ${disabled}`,
  ghost: `inline-flex min-h-[34px] cursor-pointer items-center justify-center gap-xs rounded-control px-sm text-sm font-semibold text-primary hover:bg-primary-soft ${transition} ${focus} ${disabled}`,
  icon: `inline-flex size-touch cursor-pointer items-center justify-center rounded-control border-none bg-transparent p-none text-text-muted shadow-none hover:bg-surface-muted hover:text-text-base ${transition} ${focus} ${disabled}`,
  sizes: {
    sm: 'h-touch px-sm text-xs gap-micro rounded-md',
    md: 'h-control px-lg text-sm gap-xs rounded-control',
    lg: 'px-xl py-sm text-base gap-sm rounded-lg',
  },
} as const

export const badge = {
  base: 'inline-flex items-center gap-micro rounded-pill px-sm py-micro text-xs font-medium leading-snug',
  default: 'inline-flex items-center gap-micro rounded-pill border border-border-subtle bg-surface-muted px-sm py-micro text-xs font-medium text-text-muted',
  primary: 'inline-flex items-center gap-micro rounded-pill bg-primary-soft px-sm py-micro text-xs font-medium text-primary',
  success: 'inline-flex items-center gap-micro rounded-pill bg-success-muted px-sm py-micro text-xs font-medium text-success',
  warning: 'inline-flex items-center gap-micro rounded-pill bg-warning-muted px-sm py-micro text-xs font-medium text-warning',
  danger: 'inline-flex items-center gap-micro rounded-pill bg-danger-muted px-sm py-micro text-xs font-medium text-danger',
  info: 'inline-flex items-center gap-micro rounded-pill bg-info-muted px-sm py-micro text-xs font-medium text-info',
} as const

export const card =
  'rounded-card border border-border-subtle bg-surface p-lg shadow-subtle'

export const panel =
  'min-w-none rounded-card border border-border-subtle bg-surface p-md shadow-subtle'

/** Shared control chrome — TextField and SelectField must stay identical. */
export const input =
  `box-border h-control w-full min-w-0 appearance-none rounded-control border border-border-control bg-surface px-md text-sm leading-none text-text-base shadow-xs placeholder:text-text-subtle hover:border-primary ${transition} ${focus} disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60`

export const select =
  `box-border inline-flex h-control w-full min-w-0 cursor-pointer items-center justify-between gap-sm rounded-control border border-border-control bg-surface py-0 pr-md pl-md text-left text-sm leading-none text-text-base shadow-xs hover:border-primary ${transition} ${focus} disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60`

export const inputInvalid = 'border-danger hover:border-danger'

/** Custom select menu (not native OS list). */
export const dropdown = {
  panel:
    'z-[80] flex flex-col overflow-hidden rounded-control border border-border-subtle bg-transparent p-xs shadow-float backdrop-blur-md glass',
  searchWrap:
    'mb-xs flex shrink-0 items-center gap-xs rounded-md border border-border-subtle bg-transparent px-sm py-xs',
  searchInput:
    'h-touch w-full min-w-0 border-0 bg-transparent text-sm text-text-base outline-none placeholder:text-text-subtle',
  list: 'min-h-0 flex-1 overflow-y-auto overscroll-contain',
  option:
    `flex w-full cursor-pointer items-center justify-between gap-sm rounded-md px-md py-sm text-left text-sm text-text-base ${transition}`,
  optionHover: 'bg-surface-muted/80',
  optionSelected: 'bg-primary-soft font-medium text-primary',
  optionDisabled: 'cursor-not-allowed opacity-45',
  placeholder: 'text-text-subtle',
} as const

export const label =
  'mb-xs block text-sm font-medium text-text-base'

export const tableHeader =
  'border-b border-border-subtle bg-surface-muted px-md py-sm text-left text-xs font-semibold uppercase tracking-wide text-text-muted'

export const tableRow =
  'border-b border-border-subtle text-sm text-text-base hover:bg-surface-muted'

export const modal =
  'rounded-panel border border-border-subtle bg-surface p-xl shadow-float'

export const sidebarItem =
  `flex items-center gap-sm rounded-control px-md py-sm text-sm font-medium text-text-muted no-underline hover:bg-surface-muted hover:text-text-base ${transition}`

export const sidebarItemActive =
  'flex items-center gap-sm rounded-control bg-primary-soft px-md py-sm text-sm font-semibold text-primary no-underline'

export const pageTitle =
  'font-display text-2xl font-semibold tracking-tight text-text-base sm:text-3xl'

export const pageEyebrow =
  'mb-sm text-xs font-semibold uppercase tracking-widest text-primary'

export const pageDescription =
  'mt-sm text-sm leading-relaxed text-text-muted'

export const link =
  `cursor-pointer rounded-control font-semibold text-primary hover:text-primary-hover hover:underline ${focus}`

export const notice = {
  base: 'rounded-control border p-md text-sm',
  error: 'rounded-control border border-danger bg-danger-muted p-md text-sm text-danger',
  success: 'rounded-control border border-success bg-success-muted p-md text-sm text-success',
  warning: 'rounded-control border border-warning bg-warning-muted p-md text-sm text-warning',
  info: 'rounded-control border border-info bg-info-muted p-md text-sm text-info',
} as const

export const text = {
  base: 'text-text-base',
  muted: 'text-text-muted',
  subtle: 'text-text-subtle',
  primary: 'text-primary',
  danger: 'text-danger',
} as const

/** Join class fragments without falsy values. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
