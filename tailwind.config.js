const color = (name) => `rgb(var(--color-${name}) / <alpha-value>)`
const token = (name) => `var(--${name})`

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    colors: {
      /* Primary */
      primary: color('primary'),
      'primary-hover': color('primary-hover'),
      'primary-soft': color('primary-soft'),
      'primary-disabled': color('primary-disabled'),
      'on-primary': color('on-primary'),

      /* Secondary */
      secondary: color('secondary'),
      'secondary-hover': color('secondary-hover'),
      'secondary-soft': color('secondary-soft'),
      'on-secondary': color('on-secondary'),

      /* Accent */
      accent: color('accent'),
      'accent-hover': color('accent-hover'),
      'accent-soft': color('accent-soft'),
      'on-accent': color('on-accent'),

      /* Surfaces */
      surface: color('surface'),
      'surface-muted': color('surface-muted'),
      'surface-raised': color('surface-raised'),

      /* Text */
      'text-base': color('text-base'),
      'text-muted': color('text-muted'),
      'text-subtle': color('text-subtle'),

      /* Borders */
      'border-subtle': color('border-subtle'),
      'border-control': color('border-control'),

      /* Feedback */
      danger: color('danger'),
      'danger-muted': color('danger-muted'),
      success: color('success'),
      'success-muted': color('success-muted'),
      warning: color('warning'),
      'warning-muted': color('warning-muted'),
      info: color('info'),
      'info-muted': color('info-muted'),

      /* Brand */
      'focus-ring': color('focus-ring'),
      'brand-surface': color('brand-surface'),
      'brand-line': color('brand-line'),
      'brand-deep': color('brand-deep'),

      /* Neutral Scale */
      'neutral-50': color('neutral-50'),
      'neutral-100': color('neutral-100'),
      'neutral-200': color('neutral-200'),
      'neutral-300': color('neutral-300'),
      'neutral-400': color('neutral-400'),
      'neutral-500': color('neutral-500'),
      'neutral-600': color('neutral-600'),
      'neutral-700': color('neutral-700'),
      'neutral-800': color('neutral-800'),
      'neutral-900': color('neutral-900'),
      'neutral-950': color('neutral-950'),

      /* Overlay */
      overlay: color('overlay'),

      /* Utility */
      transparent: token('color-transparent'),
      current: 'currentColor',
    },
    fontFamily: {
      sans: [token('font-sans')],
      display: [token('font-display')],
    },
    fontSize: Object.fromEntries(
      ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'].map(
        (size) => [size, token(`font-size-${size}`)],
      ),
    ),
    fontWeight: {
      normal: token('font-weight-normal'),
      medium: token('font-weight-medium'),
      semibold: token('font-weight-semibold'),
      bold: token('font-weight-bold'),
    },
    lineHeight: Object.fromEntries(
      ['none', 'tight', 'snug', 'normal', 'relaxed'].map((name) => [
        name,
        token(`line-height-${name}`),
      ]),
    ),
    letterSpacing: Object.fromEntries(
      ['tight', 'normal', 'wide', 'widest'].map((name) => [
        name,
        token(`tracking-${name}`),
      ]),
    ),
    spacing: {
      ...Object.fromEntries(
        [
          'none',
          'hairline',
          'micro',
          'tiny',
          'xs',
          'sm',
          'md',
          'lg',
          'xl',
          '2xl',
          '3xl',
          '4xl',
          '5xl',
        ].map((name) => [name, token(`space-${name}`)]),
      ),
      'icon-sm': token('size-icon-sm'),
      icon: token('size-icon'),
      control: token('size-control'),
      touch: token('size-touch'),
    },
    borderRadius: Object.fromEntries(
      [
        'none',
        'sm',
        'md',
        'control',
        'lg',
        'card',
        'xl',
        'panel',
        'pill',
      ].map((name) => [name, token(`radius-${name}`)]),
    ),
    boxShadow: Object.fromEntries(
      ['none', 'xs', 'subtle', 'card', 'float', 'overlay', 'focus'].map(
        (name) => [name, token(`shadow-${name}`)],
      ),
    ),
    borderWidth: {
      DEFAULT: token('border-width'),
      none: token('space-none'),
    },
    ringWidth: {
      DEFAULT: token('focus-width'),
      focus: token('focus-width'),
    },
    ringOffsetWidth: {
      DEFAULT: token('focus-offset'),
      focus: token('focus-offset'),
    },
    outlineWidth: {
      DEFAULT: token('focus-width'),
      focus: token('focus-width'),
    },
    outlineOffset: {
      DEFAULT: token('focus-offset'),
      focus: token('focus-offset'),
    },
    transitionDuration: {
      DEFAULT: token('duration-normal'),
      instant: token('duration-instant'),
      fast: token('duration-fast'),
      slow: token('duration-slow'),
    },
    transitionTimingFunction: {
      DEFAULT: token('ease-standard'),
      decelerate: token('ease-decelerate'),
      spring: token('ease-spring'),
    },
    extend: {
      minWidth: { none: token('space-none') },
      minHeight: { screen: token('size-viewport') },
      maxWidth: {
        form: token('size-form'),
        illustration: token('size-illustration'),
      },
      gridTemplateColumns: { auth: token('layout-auth-columns') },
      backgroundImage: { 'brand-panel': token('background-brand-panel') },
      backdropBlur: { glass: token('glass-blur') },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down': {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
      animation: {
        shimmer: 'shimmer 2s infinite linear',
        'fade-in': 'fade-in var(--duration-normal) var(--ease-decelerate)',
        'slide-up': 'slide-up var(--duration-normal) var(--ease-decelerate)',
        'slide-down':
          'slide-down var(--duration-normal) var(--ease-decelerate)',
        'scale-in': 'scale-in var(--duration-normal) var(--ease-spring)',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
