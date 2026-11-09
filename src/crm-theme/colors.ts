/**
 * BookMySKU Lagoon Glass — single source of truth for color channels.
 * Values are space-separated RGB channels for `rgb(var(--token) / <alpha>)`.
 * CSS application lives in `./tokens.css`. Keep both in sync.
 */

export type RgbChannels = `${number} ${number} ${number}`

export interface ThemeColors {
  canvas: RgbChannels
  surface: RgbChannels
  surfaceMuted: RgbChannels
  surfaceRaised: RgbChannels
  primary: RgbChannels
  primaryHover: RgbChannels
  primarySoft: RgbChannels
  primaryDisabled: RgbChannels
  onPrimary: RgbChannels
  secondary: RgbChannels
  secondaryHover: RgbChannels
  secondarySoft: RgbChannels
  onSecondary: RgbChannels
  text: RgbChannels
  textMuted: RgbChannels
  textSubtle: RgbChannels
  borderSubtle: RgbChannels
  borderControl: RgbChannels
  danger: RgbChannels
  dangerMuted: RgbChannels
  success: RgbChannels
  successMuted: RgbChannels
  warning: RgbChannels
  warningMuted: RgbChannels
  info: RgbChannels
  infoMuted: RgbChannels
  focusRing: RgbChannels
  overlay: RgbChannels
}

/** Cool mist + lagoon teal + copper commercial accent */
export const lightColors: ThemeColors = {
  canvas: '232 241 244',
  surface: '255 255 255',
  surfaceMuted: '236 244 246',
  surfaceRaised: '255 255 255',
  primary: '15 143 132',
  primaryHover: '13 120 110',
  primarySoft: '204 240 236',
  primaryDisabled: '196 214 220',
  onPrimary: '255 255 255',
  secondary: '197 106 30',
  secondaryHover: '180 90 20',
  secondarySoft: '255 237 213',
  onSecondary: '255 255 255',
  text: '15 35 45',
  textMuted: '71 98 112',
  textSubtle: '120 148 162',
  borderSubtle: '196 214 220',
  borderControl: '148 176 188',
  danger: '183 39 49',
  dangerMuted: '255 241 242',
  success: '15 118 90',
  successMuted: '220 252 231',
  warning: '180 83 9',
  warningMuted: '255 247 237',
  info: '3 105 161',
  infoMuted: '224 242 254',
  focusRing: '15 143 132',
  overlay: '7 19 31',
}

/** Ink atmosphere + lagoon + copper */
export const darkColors: ThemeColors = {
  canvas: '7 19 31',
  surface: '18 32 46',
  surfaceMuted: '14 28 42',
  surfaceRaised: '24 40 56',
  primary: '18 182 166',
  primaryHover: '45 200 184',
  primarySoft: '8 48 52',
  primaryDisabled: '30 55 68',
  onPrimary: '4 24 28',
  secondary: '224 138 58',
  secondaryHover: '240 160 80',
  secondarySoft: '62 40 18',
  onSecondary: '4 24 28',
  text: '201 214 222',
  textMuted: '148 170 184',
  textSubtle: '110 135 150',
  borderSubtle: '36 54 70',
  borderControl: '55 78 96',
  danger: '242 157 145',
  dangerMuted: '64 37 33',
  success: '61 207 154',
  successMuted: '6 48 39',
  warning: '251 191 36',
  warningMuted: '62 45 13',
  info: '96 165 250',
  infoMuted: '23 37 84',
  focusRing: '18 182 166',
  overlay: '0 0 0',
}

export const colors = {
  light: lightColors,
  dark: darkColors,
  /** Semantic aliases used by JS consumers */
  cssVar: {
    primary: '--color-primary',
    secondary: '--color-secondary',
    canvas: '--color-canvas',
    surface: '--color-surface',
    text: '--color-text-base',
    textMuted: '--color-text-muted',
    border: '--color-border-subtle',
    danger: '--color-danger',
    success: '--color-success',
    warning: '--color-warning',
  },
} as const
