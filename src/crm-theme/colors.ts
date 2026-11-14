/** Semantic references resolve the active theme. Literal colors live in tokens.css. */
export type RgbChannels = `${number} ${number} ${number}`
type ColorReference = `rgb(var(--color-${string}))`

const color = (token: string): ColorReference => `rgb(var(--color-${token}))`
const references = {
  canvas: color('canvas'),
  surface: color('surface'),
  surfaceMuted: color('surface-muted'),
  surfaceRaised: color('surface-raised'),
  primary: color('primary'),
  primaryHover: color('primary-hover'),
  primaryInk: color('primary-ink'),
  primaryInkHover: color('primary-ink-hover'),
  primarySoft: color('primary-soft'),
  primaryDisabled: color('primary-disabled'),
  onPrimary: color('on-primary'),
  secondary: color('secondary'),
  secondaryHover: color('secondary-hover'),
  secondarySoft: color('secondary-soft'),
  onSecondary: color('on-secondary'),
  text: color('text-base'),
  textMuted: color('text-muted'),
  textSubtle: color('text-subtle'),
  borderSubtle: color('border-subtle'),
  borderControl: color('border-control'),
  danger: color('danger'),
  dangerMuted: color('danger-muted'),
  success: color('success'),
  successMuted: color('success-muted'),
  warning: color('warning'),
  warningMuted: color('warning-muted'),
  info: color('info'),
  infoMuted: color('info-muted'),
  focusRing: color('focus-ring'),
  overlay: color('overlay'),
} as const
export type ThemeColors = typeof references

// Retain legacy names; these references follow the active light/dark CSS theme.
export const lightColors = references
export const darkColors = references
export const colors = {
  light: lightColors,
  dark: darkColors,
  cssVar: {
    primary: '--color-primary', secondary: '--color-secondary', canvas: '--color-canvas',
    surface: '--color-surface', text: '--color-text-base', textMuted: '--color-text-muted',
    border: '--color-border-subtle', danger: '--color-danger', success: '--color-success',
    warning: '--color-warning',
  },
} as const
