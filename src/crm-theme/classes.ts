/** Reusable component classes. Visual rules live in components.css. */
export const glassCard = 'glass-card'
export const glassPanel = 'glass-panel'
export const glassModal = 'glass-modal'
export const button = {
  base: 'crm-button',
  primary: 'crm-button crm-button-primary',
  secondary: 'crm-button crm-button-secondary',
  danger: 'crm-button crm-button-danger',
  ghost: 'crm-button crm-button-ghost',
  icon: 'crm-button crm-button-icon icon-button',
  sizes: { sm: 'crm-button-sm', md: 'crm-button-md', lg: 'crm-button-lg' },
} as const
export const badge = {
  base: 'crm-badge',
  default: 'crm-badge crm-badge-default',
  primary: 'crm-badge crm-badge-primary',
  success: 'crm-badge crm-badge-success',
  warning: 'crm-badge crm-badge-warning',
  danger: 'crm-badge crm-badge-danger',
  info: 'crm-badge crm-badge-info',
} as const
export const card = 'glass-card crm-card'
export const panel = 'glass-panel'
export const input = 'crm-input box-border h-control w-full min-w-0 appearance-none text-sm leading-none'
export const select = 'crm-input crm-select box-border inline-flex h-control w-full min-w-0 cursor-pointer items-center justify-between gap-sm py-none pr-md pl-md text-left text-sm leading-none'
export const inputInvalid = 'crm-input-invalid'
export const dropdown = {
  panel: 'glass-dropdown flex flex-col overflow-hidden p-xs',
  searchWrap: 'crm-dropdown-search mb-xs flex shrink-0 items-center gap-xs rounded-md border border-border-subtle bg-transparent px-sm py-xs',
  searchInput: 'h-touch w-full min-w-0 border-0 bg-transparent text-sm text-text-base outline-none placeholder:text-text-subtle',
  list: 'min-h-0 flex-1 overflow-y-auto overscroll-contain',
  option: 'crm-dropdown-option flex w-full cursor-pointer items-center justify-between gap-sm px-md py-sm text-left text-sm',
  optionHover: 'crm-dropdown-option-hover',
  optionSelected: 'crm-dropdown-option-selected',
  optionDisabled: 'crm-disabled',
  placeholder: 'text-text-subtle',
} as const
export const label = 'crm-label mb-xs block text-sm font-medium'
export const tableHeader = 'crm-table-header'
export const tableRow = 'crm-table-row'
export const modal = glassModal
export const sidebarItem = 'crm-sidebar-item'
export const sidebarItemActive = 'crm-sidebar-item crm-sidebar-item-active'
export const tabs = 'crm-tabs'
export const pageTitle = 'font-display text-2xl font-semibold tracking-tight text-text-base sm:text-3xl'
export const pageEyebrow = 'mb-xs text-xs font-medium text-text-subtle'
export const pageDescription = 'mt-xs text-sm leading-relaxed text-text-muted'
export const link = 'crm-link'
export const notice = {
  base: 'crm-notice',
  error: 'crm-notice crm-notice-error',
  success: 'crm-notice crm-notice-success',
  warning: 'crm-notice crm-notice-warning',
  info: 'crm-notice crm-notice-info',
} as const
export const text = {
  base: 'text-text-base', muted: 'text-text-muted', subtle: 'text-text-subtle',
  primary: 'text-primary', danger: 'text-danger',
} as const
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
