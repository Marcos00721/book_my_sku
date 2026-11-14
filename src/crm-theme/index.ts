import { colors } from './colors'
import * as classes from './classes'

/**
 * Central CRM theme entry.
 *
 * @example
 *   import { theme } from '@/crm-theme'
 *   <button className={theme.button.primary}>Save</button>
 */
export const theme = {
  colors,
  button: classes.button,
  badge: classes.badge,
  card: classes.card,
  glassCard: classes.glassCard,
  glassPanel: classes.glassPanel,
  glassModal: classes.glassModal,
  panel: classes.panel,
  input: classes.input,
  select: classes.select,
  inputInvalid: classes.inputInvalid,
  dropdown: classes.dropdown,
  label: classes.label,
  tableHeader: classes.tableHeader,
  tableRow: classes.tableRow,
  modal: classes.modal,
  tabs: classes.tabs,
  sidebarItem: classes.sidebarItem,
  sidebarItemActive: classes.sidebarItemActive,
  pageTitle: classes.pageTitle,
  pageEyebrow: classes.pageEyebrow,
  pageDescription: classes.pageDescription,
  link: classes.link,
  notice: classes.notice,
  text: classes.text,
  cx: classes.cx,
} as const

export type Theme = typeof theme

export { colors, lightColors, darkColors } from './colors'
export type { ThemeColors, RgbChannels } from './colors'
export {
  button,
  badge,
  card,
  glassCard,
  glassPanel,
  glassModal,
  panel,
  input,
  select,
  inputInvalid,
  dropdown,
  label,
  tableHeader,
  tableRow,
  modal,
  tabs,
  sidebarItem,
  sidebarItemActive,
  pageTitle,
  pageEyebrow,
  pageDescription,
  link,
  notice,
  text,
  cx,
} from './classes'

export default theme
