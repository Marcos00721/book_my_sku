```text
book-my-sku/
├── .gitignore
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
├── postcss.config.js
├── tailwind.config.js
├── playwright.config.js
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css
│   ├── styles/
│   │   └── theme.css
│   ├── components/
│   │   ├── auth/
│   │   │   ├── BrandMark.jsx
│   │   │   ├── AuthLayout.jsx
│   │   │   └── AuthPageContent.jsx
│   │   └── forms/
│   │       ├── useAppForm.js
│   │       ├── AppFormProvider.jsx
│   │       ├── FormLabel.jsx
│   │       ├── FormTextField.jsx
│   │       ├── FormPhoneField.jsx
│   │       ├── FormPasswordField.jsx
│   │       └── FormSubmitButton.jsx
│   ├── utils/
│   │   └── phone.js
│   ├── schemas/
│   │   └── authSchemas.js
│   └── pages/
│       ├── LoginPage.jsx
│       ├── RegisterPage.jsx
│       └── AccountHelpPage.jsx
└── tests/
    └── auth.spec.js
```

Implemented locally. Run `npm run dev` and visit `/login` or `/register`. `/` redirects to `/login`. The forgot-password link opens `/forgot-password`, an account recovery help page; password reset emails are outside this console-only implementation.

Run `npm run build` and `npm run test:e2e` to verify the JavaScript app. Browser tests exercise validation, phone formatting, navigation, responsive layouts, and reduced motion using locally installed Google Chrome.

Full code for every authored application, configuration, and test file follows. The npm-generated `package-lock.json` is already saved in the workspace; reproduce it with `npm install` when copying these files elsewhere. Existing unused starter assets, `App.css`, and the existing ESLint configuration are unchanged.

**.gitignore**

```text
# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
playwright-report
test-results
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
```

**package.json**

```json
{
  "name": "book-my-sku",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test:e2e": "playwright test",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "@hookform/resolvers": "^5.9.1",
    "framer-motion": "^14.2.0",
    "lucide-react": "^1.57.0",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "react-hook-form": "^7.90.0",
    "react-router-dom": "^7.18.4",
    "zod": "^4.6.7"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@playwright/test": "^1.64.1",
    "@tailwindcss/postcss": "^4.3.3",
    "@vitejs/plugin-react": "^6.1.1",
    "eslint": "^10.10.0",
    "eslint-plugin-react-hooks": "^7.1.1",
    "eslint-plugin-react-refresh": "^0.5.6",
    "globals": "^17.12.0",
    "postcss": "^8.5.30",
    "tailwindcss": "^4.3.3",
    "vite": "^8.3.0"
  }
}
```

**index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Sign in to BookMySku. A simpler way to keep your inventory, orders, and business moving together." />
    <title>BookMySku | Your business, in sync</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

**vite.config.js**

```js
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: false,
  }
})
```

**postcss.config.js**

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

**tailwind.config.js**

```js
const color = (name) => `rgb(var(--color-${name}) / <alpha-value>)`
const token = (name) => `var(--${name})`

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    colors: {
      primary: color('primary'),
      'primary-hover': color('primary-hover'),
      'primary-soft': color('primary-soft'),
      'primary-disabled': color('primary-disabled'),
      'on-primary': color('on-primary'),
      surface: color('surface'),
      'surface-muted': color('surface-muted'),
      'text-base': color('text-base'),
      'text-muted': color('text-muted'),
      'border-subtle': color('border-subtle'),
      'border-control': color('border-control'),
      danger: color('danger'),
      'danger-muted': color('danger-muted'),
      success: color('success'),
      'success-muted': color('success-muted'),
      'focus-ring': color('focus-ring'),
      'brand-surface': color('brand-surface'),
      'brand-line': color('brand-line'),
      'brand-deep': color('brand-deep'),
      transparent: token('color-transparent'),
      current: 'currentColor',
    },
    fontFamily: { sans: [token('font-sans')], display: [token('font-display')] },
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
      ['none', 'tight', 'snug', 'normal', 'relaxed'].map(
        (name) => [name, token(`line-height-${name}`)],
      ),
    ),
    letterSpacing: Object.fromEntries(
      ['tight', 'normal', 'wide', 'widest'].map(
        (name) => [name, token(`tracking-${name}`)],
      ),
    ),
    spacing: {
      ...Object.fromEntries(
        ['none', 'hairline', 'micro', 'tiny', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'].map(
          (name) => [name, token(`space-${name}`)],
        ),
      ),
      'icon-sm': token('size-icon-sm'),
      icon: token('size-icon'),
      control: token('size-control'),
      touch: token('size-touch'),
    },
    borderRadius: Object.fromEntries(
      ['none', 'control', 'card', 'panel', 'pill'].map(
        (name) => [name, token(`radius-${name}`)],
      ),
    ),
    boxShadow: Object.fromEntries(
      ['none', 'subtle', 'card', 'float', 'focus'].map(
        (name) => [name, token(`shadow-${name}`)],
      ),
    ),
    borderWidth: { DEFAULT: token('border-width'), none: token('space-none') },
    ringWidth: { DEFAULT: token('focus-width'), focus: token('focus-width') },
    ringOffsetWidth: { DEFAULT: token('focus-offset'), focus: token('focus-offset') },
    outlineWidth: { DEFAULT: token('focus-width'), focus: token('focus-width') },
    outlineOffset: { DEFAULT: token('focus-offset'), focus: token('focus-offset') },
    transitionDuration: { DEFAULT: token('duration-normal'), fast: token('duration-fast') },
    transitionTimingFunction: { DEFAULT: token('ease-standard') },
    extend: {
      minWidth: { none: token('space-none') },
      minHeight: { screen: token('size-viewport') },
      maxWidth: { form: token('size-form'), illustration: token('size-illustration') },
      gridTemplateColumns: { auth: token('layout-auth-columns') },
      backgroundImage: { 'brand-panel': token('background-brand-panel') },
    },
  },
  plugins: [],
}
```

**playwright.config.js**

```js
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: true,
  },
})
```

**src/main.jsx**

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </BrowserRouter>
  </StrictMode>
)
```

**src/App.jsx**

```jsx
import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

const LoginPage = lazy(() => import('./pages/LoginPage').then((page) => ({ default: page.LoginPage })))
const RegisterPage = lazy(() => import('./pages/RegisterPage').then((page) => ({ default: page.RegisterPage })))
const AccountHelpPage = lazy(() => import('./pages/AccountHelpPage').then((page) => ({ default: page.AccountHelpPage })))

export default function App() {
  return (
    <Suspense fallback={<div role="status" className="flex min-h-screen items-center justify-center bg-surface px-lg text-text-muted">Opening your workspace…</div>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<AccountHelpPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  )
}
```

**src/index.css**

```css
@import './styles/theme.css';
@import 'tailwindcss';
@config '../tailwind.config.js';

@layer base {
  html {
    @apply bg-surface font-sans leading-normal text-text-base antialiased;
  }

  body {
    @apply m-none min-w-none;
  }

  button,
  input,
  a {
    -webkit-tap-highlight-color: var(--color-transparent);
  }

  ::selection {
    @apply bg-primary-soft text-brand-deep;
  }

  input:-webkit-autofill {
    -webkit-text-fill-color: rgb(var(--color-text-base));
    -webkit-box-shadow: 0 0 0 var(--space-5xl) rgb(var(--color-surface)) inset;
    caret-color: rgb(var(--color-text-base));
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: var(--duration-reduced) !important;
      animation-iteration-count: 1 !important;
      transition-duration: var(--duration-reduced) !important;
      scroll-behavior: auto !important;
    }
  }
}

@layer components {
  .app-link {
    @apply rounded-control font-semibold text-primary transition-colors hover:text-primary-hover hover:underline focus-visible:outline focus-visible:outline-focus focus-visible:outline-offset-focus focus-visible:outline-focus-ring;
    text-underline-offset: var(--underline-offset);
  }
}
```

**src/styles/theme.css**

```css
:root {
  /* Color channels support Tailwind opacity modifiers without duplicated colors. */
  --color-primary: 66 82 222;
  --color-primary-hover: 49 63 191;
  --color-primary-soft: 237 240 255;
  --color-primary-disabled: 113 125 216;
  --color-on-primary: 255 255 255;
  --color-surface: 255 255 255;
  --color-surface-muted: 249 250 252;
  --color-text-base: 28 35 52;
  --color-text-muted: 97 107 128;
  --color-border-subtle: 222 227 237;
  --color-border-control: 136 146 165;
  --color-danger: 183 39 49;
  --color-danger-muted: 255 241 242;
  --color-success: 28 113 79;
  --color-success-muted: 233 247 239;
  --color-focus-ring: var(--color-primary);
  --color-brand-surface: 241 244 255;
  --color-brand-line: 214 222 247;
  --color-brand-deep: 36 46 98;
  --color-transparent: transparent;

  --font-sans: 'Inter', 'Segoe UI', system-ui, sans-serif;
  --font-display: 'Manrope', 'Inter', 'Segoe UI', system-ui, sans-serif;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
  --font-size-3xl: 2rem;
  --font-size-4xl: 2.5rem;
  --font-size-5xl: clamp(2.5rem, 3.5vw, 3.5rem);
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --line-height-none: 1;
  --line-height-tight: 1.15;
  --line-height-snug: 1.375;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.65;
  --tracking-tight: -0.035em;
  --tracking-normal: 0;
  --tracking-wide: 0.04em;
  --tracking-widest: 0.12em;
  --underline-offset: 0.25em;

  --space-none: 0;
  --space-hairline: 1px;
  --space-micro: 0.25rem;
  --space-tiny: 0.375rem;
  --space-xs: 0.5rem;
  --space-sm: 0.75rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  --space-2xl: 3rem;
  --space-3xl: 4rem;
  --space-4xl: 5rem;
  --space-5xl: 6rem;
  --size-icon-sm: 1rem;
  --size-icon: 1.25rem;
  --size-control: 3rem;
  --size-touch: 2.75rem;
  --size-form: 28rem;
  --size-illustration: 27rem;
  --size-viewport: 100svh;
  --layout-auth-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);

  --radius-none: 0;
  --radius-control: 0.625rem;
  --radius-card: 1.125rem;
  --radius-panel: 1.75rem;
  --radius-pill: 9999px;
  --border-width: 1px;
  --focus-width: 2px;
  --focus-offset: 3px;
  --shadow-none: none;
  --shadow-subtle: 0 2px 5px rgb(var(--color-brand-deep) / 0.04);
  --shadow-card: 0 16px 48px -16px rgb(var(--color-brand-deep) / 0.16);
  --shadow-float: 0 12px 36px -10px rgb(var(--color-brand-deep) / 0.2);
  --shadow-focus: 0 0 0 var(--focus-width) rgb(var(--color-surface)), 0 0 0 calc(var(--focus-width) + var(--focus-offset)) rgb(var(--color-focus-ring));
  --background-brand-panel: radial-gradient(ellipse at 15% 15%, rgb(var(--color-surface) / 0.9), var(--color-transparent) 55%), linear-gradient(150deg, rgb(var(--color-brand-surface)), rgb(var(--color-primary-soft)));
  --duration-fast: 150ms;
  --duration-normal: 200ms;
  --duration-reduced: 0.01ms;
  --ease-standard: cubic-bezier(0.2, 0.7, 0.2, 1);
}
```

**src/components/auth/BrandMark.jsx**

```jsx
import { Layers3 } from 'lucide-react'
import { Link } from 'react-router-dom'

export function BrandMark() {
  return (
    <Link
      to="/login"
      aria-label="BookMySku home"
      className="inline-flex w-fit items-center gap-sm rounded-control font-display text-xl font-semibold tracking-tight text-text-base outline-none focus-visible:ring-focus focus-visible:ring-primary focus-visible:ring-offset-focus focus-visible:ring-offset-brand-surface"
    >
      <span className="flex h-touch w-touch items-center justify-center rounded-control bg-primary text-surface shadow-subtle">
        <Layers3 className="h-icon w-icon" aria-hidden="true" />
      </span>
      BookMySku<span className="sr-only"> home</span>
    </Link>
  )
}
```

**src/components/auth/AuthLayout.jsx**

```jsx
import { ArrowUpRight, Check, ChevronRight, Coffee, Package, ShieldCheck, ShoppingBag, Sparkles } from 'lucide-react'
import { BrandMark } from './BrandMark'

const inventoryProducts = [
  { name: 'Studio desk lamp', sku: 'SKU-LMP-042', stock: '128 in stock', Icon: Package },
  { name: 'Everyday tote', sku: 'SKU-BAG-018', stock: '256 in stock', Icon: ShoppingBag },
  { name: 'Ceramic coffee mug', sku: 'SKU-MUG-063', stock: '384 in stock', Icon: Coffee },
]

function InventoryIllustration() {
  return (
    <div aria-hidden="true" className="relative mx-auto mb-xl mt-2xl w-full max-w-illustration pb-xl">
      <div className="overflow-hidden rounded-card border border-border-subtle bg-surface shadow-card">
        <div className="flex items-center justify-between gap-sm border-b border-border-subtle p-lg">
          <div className="flex items-center gap-sm">
            <span className="flex h-touch w-touch items-center justify-center rounded-control bg-primary-soft text-primary">
              <Package className="h-icon w-icon" />
            </span>
            <div>
              <p className="text-sm font-semibold text-text-base">Inventory overview</p>
              <p className="mt-micro text-xs text-text-muted">Everything in its right place.</p>
            </div>
          </div>
          <span className="rounded-pill bg-success-muted px-xs py-micro text-xs font-medium text-success">Live</span>
        </div>
        <div className="grid grid-cols-2 gap-md border-b border-border-subtle px-lg py-md">
          <div>
            <p className="text-xs text-text-muted">Total products</p>
            <p className="mt-xs font-display text-2xl font-semibold tracking-tight text-text-base">1,284</p>
          </div>
          <div className="border-l border-border-subtle pl-lg">
            <p className="text-xs text-text-muted">Inventory accuracy</p>
            <p className="mt-xs font-display text-2xl font-semibold tracking-tight text-text-base">99.8<span className="text-lg">%</span></p>
          </div>
        </div>
        <div className="divide-y divide-border-subtle px-lg">
          {inventoryProducts.map(({ name, sku, stock, Icon }) => (
            <div key={sku} className="flex items-center gap-sm py-md">
              <span className="flex h-touch w-touch shrink-0 items-center justify-center rounded-control border border-border-subtle bg-surface-muted text-text-muted">
                <Icon className="h-icon w-icon" />
              </span>
              <div className="min-w-none flex-1">
                <p className="truncate text-xs font-medium text-text-base">{name}</p>
                <p className="mt-micro text-xs text-text-muted">{sku}</p>
              </div>
              <span className="whitespace-nowrap text-xs text-success">{stock}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-border-subtle bg-surface-muted px-lg py-sm text-xs text-text-muted">
          <span>One clear view. More control.</span>
          <ChevronRight className="h-icon-sm w-icon-sm" />
        </div>
      </div>
      <div className="absolute bottom-none right-md flex items-center gap-sm rounded-card border border-border-subtle bg-surface px-lg py-md shadow-float">
        <span className="flex h-touch w-touch items-center justify-center rounded-pill bg-success-muted text-success">
          <Check className="h-icon w-icon" />
        </span>
        <div>
          <p className="text-sm font-semibold text-text-base">Another order, sorted.</p>
          <p className="mt-micro flex items-center gap-micro text-xs text-text-muted">
            Ready for what comes next <ArrowUpRight className="h-icon-sm w-icon-sm" />
          </p>
        </div>
      </div>
    </div>
  )
}

export function AuthLayout({ variant, children }) {
  return (
    <div className="min-h-screen bg-surface font-sans text-text-base lg:grid lg:grid-cols-auth">
      <aside className="relative hidden min-h-screen flex-col overflow-hidden border-r border-brand-line bg-brand-panel px-2xl py-xl lg:flex xl:px-3xl">
        <BrandMark />
        <div className="my-xl flex flex-1 flex-col justify-center">
          <div className="mx-auto w-full max-w-illustration">
            <p className="mb-lg inline-flex items-center gap-xs rounded-pill border border-brand-line bg-brand-surface px-sm py-xs text-xs font-medium text-brand-deep">
              <Sparkles className="h-icon-sm w-icon-sm" aria-hidden="true" />
              A little more organized. A lot more possible.
            </p>
            <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight text-text-base xl:text-5xl">
              Less busywork.<br /><span className="text-primary">More business.</span>
            </h2>
            <p className="mt-lg text-base leading-relaxed text-text-muted">
              Your products, orders, and next big idea.<br />One place to keep it all moving.
            </p>
          </div>
          <InventoryIllustration />
          <p className="mx-auto flex w-full max-w-illustration items-center gap-xs text-xs text-brand-deep">
            <ShieldCheck className="h-icon-sm w-icon-sm shrink-0" aria-hidden="true" />
            A calmer workspace for a growing business.
          </p>
        </div>
        <p className="text-xs text-text-muted">Built for the way your business grows.</p>
      </aside>

      <main className="flex min-h-screen min-w-none flex-col px-lg py-lg sm:px-xl lg:px-2xl lg:py-xl xl:px-3xl">
        <div className="mb-xl lg:hidden"><BrandMark /></div>
        <div className="flex flex-1 items-center justify-center py-lg lg:py-xl">
          <div className="w-full max-w-form" key={variant}>{children}</div>
        </div>
        <footer className="mt-xl flex flex-wrap items-center justify-center gap-xs text-center text-xs leading-relaxed text-text-muted">
          <ShieldCheck className="h-icon-sm w-icon-sm shrink-0" aria-hidden="true" />
          <span>Your business starts with a little peace of mind.</span>
        </footer>
      </main>
    </div>
  )
}
```

**src/components/auth/AuthPageContent.jsx**

```jsx
import { useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

export function AuthPageContent({ id, title, eyebrow, description, children }) {
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    document.title = `${title} | BookMySku`
  }, [title])

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.35 }}
    >
      <header className="mb-xl">
        <p className="mb-sm text-xs font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>
        <h1 id={id} className="font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-sm text-sm leading-relaxed text-text-muted">{description}</p>
      </header>
      {children}
    </motion.div>
  )
}
```

**src/components/forms/useAppForm.js**

```js
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

/** Shared defaults keep validation behavior consistent across the app. */
export function useAppForm(schema, options = {}) {
  return useForm({
    reValidateMode: 'onChange',
    shouldFocusError: true,
    ...options,
    mode: 'onTouched',
    resolver: zodResolver(schema),
  });
}
```

**src/components/forms/AppFormProvider.jsx**

```jsx
import { useEffect } from 'react';
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { FormProvider } from 'react-hook-form';

/** Pair with useAppForm(schema) to apply the shared Zod resolver. */
export function AppFormProvider({
  form,
  onSubmit,
  onInvalid,
  children,
  className,
  'aria-labelledby': labelledBy,
}) {
  const controls = useAnimationControls();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    void controls.start('visible');
  }, [controls]);

  const handleInvalidSubmit = (errors, event) => {
    if (!reducedMotion) {
      void controls.start({
        x: [0, -5, 5, -3, 3, 0],
        transition: { duration: 0.32 },
      });
    }

    void onInvalid?.(errors, event);
  };

  return (
    <FormProvider {...form}>
      <motion.form
        noValidate
        aria-labelledby={labelledBy}
        className={className}
        onSubmit={form.handleSubmit(onSubmit, handleInvalidSubmit)}
        initial={reducedMotion ? false : 'hidden'}
        animate={controls}
        variants={{
          hidden: {},
          visible: {
            transition: {
              staggerChildren: reducedMotion ? 0 : 0.055,
            },
          },
        }}
      >
        {children}
      </motion.form>
    </FormProvider>
  );
}
```

**src/components/forms/FormLabel.jsx**

```jsx
export function FormLabel({ className = '', children, ...props }) {
  return (
    <label
      {...props}
      className={`mb-xs block text-sm font-medium text-text-base ${className}`}
    >
      {children}
    </label>
  );
}
```

**src/components/forms/FormTextField.jsx**

```jsx
import { useId } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useController, useFormContext } from 'react-hook-form';
import { FormLabel } from './FormLabel';

export function FormTextField({
  name,
  label,
  id,
  icon,
  hint,
  trailingControl,
  formatValue,
  disabled,
  className = '',
  onChange,
  onBlur,
  'aria-describedby': describedBy,
  ...inputProps
}) {
  const generatedId = useId();
  const inputId = id ?? `${name}-${generatedId}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const { control, formState } = useFormContext();
  const { field, fieldState } = useController({ name, control, disabled });
  const reducedMotion = useReducedMotion();
  const errorMessage = fieldState.error?.message;
  const isDisabled = Boolean(
    field.disabled || formState.disabled || disabled || formState.isSubmitting,
  );
  const descriptionIds = [
    hint ? hintId : undefined,
    errorMessage ? errorId : undefined,
    describedBy,
  ]
    .filter(Boolean)
    .join(' ');

  const handleChange = (event) => {
    const input = event.currentTarget;
    const originalValue = input.value;
    const nextValue = formatValue ? formatValue(originalValue) : originalValue;
    const selectionStart = input.selectionStart;

    field.onChange(nextValue);
    onChange?.(event);

    // Preserve the edit position when formatting an insertion or a paste.
    if (formatValue && selectionStart !== null) {
      const digitsBeforeCaret = originalValue
        .slice(0, selectionStart)
        .replace(/\D/g, '').length;
      let nextCaret = 0;
      let digitsSeen = 0;

      while (nextCaret < nextValue.length && digitsSeen < digitsBeforeCaret) {
        if (/\d/.test(nextValue[nextCaret])) digitsSeen += 1;
        nextCaret += 1;
      }

      // Delete moves past a restored separator so repeated Delete keeps editing.
      if (event.nativeEvent.inputType === 'deleteContentForward') {
        while (nextCaret < nextValue.length && /\D/.test(nextValue[nextCaret])) {
          nextCaret += 1;
        }
      }

      requestAnimationFrame(() => {
        if (document.activeElement === input) {
          input.setSelectionRange(nextCaret, nextCaret);
        }
      });
    }
  };

  return (
    <motion.div
      className={`min-w-none ${className}`}
      variants={{
        hidden: { opacity: 0, y: reducedMotion ? 0 : 8 },
        visible: { opacity: 1, y: 0, transition: { duration: reducedMotion ? 0 : 0.28 } },
      }}
    >
      <FormLabel htmlFor={inputId}>
        {label}
      </FormLabel>
      <div className="relative">
        {icon && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-none left-md flex items-center text-text-muted [&>svg]:size-icon"
          >
            {icon}
          </span>
        )}
        <input
          {...inputProps}
          {...field}
          id={inputId}
          value={field.value ?? ''}
          disabled={isDisabled}
          aria-invalid={Boolean(errorMessage)}
          aria-describedby={descriptionIds || undefined}
          onChange={handleChange}
          onBlur={(event) => {
            field.onBlur();
            onBlur?.(event);
          }}
          className={[
            'h-control w-full min-w-none rounded-control border bg-surface px-md py-sm text-base text-text-base',
            'placeholder:text-text-muted focus-visible:border-primary focus-visible:shadow-focus focus-visible:outline-none',
            'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted motion-safe:transition-shadow',
            errorMessage ? 'border-danger' : 'border-border-control',
            icon ? 'pl-control' : '',
            trailingControl ? 'pr-control' : '',
          ].join(' ')}
        />
        {trailingControl}
      </div>
      {hint && (
        <p id={hintId} className="mt-xs text-xs leading-relaxed text-text-muted">
          {hint}
        </p>
      )}
      <AnimatePresence initial={false}>
        {errorMessage && (
          <motion.p
            id={errorId}
            key={errorId}
            role="alert"
            initial={reducedMotion ? false : { opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: reducedMotion ? 0 : -4 }}
            transition={{ duration: reducedMotion ? 0 : 0.18 }}
            className="overflow-hidden pt-xs text-xs leading-relaxed text-danger"
          >
            {errorMessage}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
```

**src/components/forms/FormPhoneField.jsx**

```jsx
import { Phone } from 'lucide-react';
import { formatUSPhoneNumber } from '../../utils/phone';
import { FormTextField } from './FormTextField';

export function FormPhoneField({
  icon = <Phone />,
  autoComplete = 'tel-national',
  placeholder = '202-555-0123',
  ...props
}) {
  return (
    <FormTextField
      {...props}
      type="tel"
      inputMode="tel"
      autoComplete={autoComplete}
      placeholder={placeholder}
      icon={icon}
      formatValue={formatUSPhoneNumber}
    />
  );
}
```

**src/components/forms/FormPasswordField.jsx**

```jsx
import { useState } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import { FormTextField } from './FormTextField';

export function FormPasswordField({
  label,
  icon = <LockKeyhole />,
  disabled,
  ...props
}) {
  const [isVisible, setIsVisible] = useState(false);
  const { formState } = useFormContext();
  const VisibilityIcon = isVisible ? EyeOff : Eye;

  return (
    <FormTextField
      {...props}
      label={label}
      disabled={disabled}
      type={isVisible ? 'text' : 'password'}
      icon={icon}
      trailingControl={
        <button
          type="button"
          aria-label={`${isVisible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          aria-pressed={isVisible}
          disabled={disabled || formState.disabled || formState.isSubmitting}
          onClick={() => setIsVisible((visible) => !visible)}
          className="absolute inset-y-none right-micro my-auto flex size-touch items-center justify-center rounded-control text-text-muted hover:text-primary focus-visible:shadow-focus focus-visible:outline-none disabled:cursor-not-allowed"
        >
          <VisibilityIcon aria-hidden="true" className="size-icon" />
        </button>
      }
    />
  );
}
```

**src/components/forms/FormSubmitButton.jsx**

```jsx
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { useFormContext } from 'react-hook-form';

export function FormSubmitButton({
  children,
  pendingLabel = 'Submitting…',
  disabled = false,
  className = '',
}) {
  const { formState } = useFormContext();
  const reducedMotion = useReducedMotion();
  const isDisabled = disabled || formState.disabled || formState.isSubmitting;

  return (
    <motion.button
      type="submit"
      disabled={isDisabled}
      aria-busy={formState.isSubmitting}
      whileHover={reducedMotion || isDisabled ? undefined : { y: -1 }}
      whileTap={reducedMotion || isDisabled ? undefined : { scale: 0.985 }}
      className={[
        'flex h-control w-full items-center justify-center gap-sm rounded-control bg-primary px-lg py-sm text-sm font-semibold text-on-primary shadow-subtle',
        'hover:bg-primary-hover focus-visible:shadow-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-primary-disabled motion-safe:transition-colors',
        className,
      ].join(' ')}
    >
      <span aria-live="polite">{formState.isSubmitting ? pendingLabel : children}</span>
      {formState.isSubmitting ? (
        <LoaderCircle aria-hidden="true" className="size-icon motion-safe:animate-spin" />
      ) : (
        <ArrowRight aria-hidden="true" className="size-icon-sm" />
      )}
    </motion.button>
  );
}
```

**src/utils/phone.js**

```js
/** Keep the digits from a phone number without changing their length. */
export function stripPhoneFormatting(value) {
  return value.replace(/\D/g, '');
}

/** Format partial input and pasted values as a US phone number. */
export function formatUSPhoneNumber(value) {
  const digits = stripPhoneFormatting(value).slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;

  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Validate the raw digits after removing display formatting. */
export const usPhoneRegex = /^\d{10}$/;
```

**src/schemas/authSchemas.js**

```js
import { z } from 'zod';
import { stripPhoneFormatting, usPhoneRegex } from '../utils/phone';

const emailFieldSchema = z
  .string()
  .trim()
  .min(1, 'Enter your email address.')
  .email('Enter a valid email address.');

const registrationPasswordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(128, 'Use no more than 128 characters.')
  .regex(/[a-z]/, 'Include a lowercase letter.')
  .regex(/[A-Z]/, 'Include an uppercase letter.')
  .regex(/\d/, 'Include a number.');

export const loginFormSchema = z.object({
  email: emailFieldSchema,
  password: z.string().min(1, 'Enter your password.'),
});

export const registerFormSchema = z
  .object({
    firstName: z.string().trim().min(1, 'Enter your first name.'),
    lastName: z.string().trim().min(1, 'Enter your last name.'),
    email: emailFieldSchema,
    phone: z.string().refine(
      (value) =>
        /^[\d\s()+.-]+$/.test(value) &&
        usPhoneRegex.test(stripPhoneFormatting(value)),
      'Enter a 10-digit US phone number.',
    ),
    organizationName: z.string().trim().min(1, 'Enter your organization name.'),
    password: registrationPasswordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Your passwords do not match.',
    path: ['confirmPassword'],
  });
```

**src/pages/LoginPage.jsx**

```jsx
import { Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../components/auth/AuthLayout'
import { AuthPageContent } from '../components/auth/AuthPageContent'
import { AppFormProvider } from '../components/forms/AppFormProvider'
import { FormPasswordField } from '../components/forms/FormPasswordField'
import { FormSubmitButton } from '../components/forms/FormSubmitButton'
import { FormTextField } from '../components/forms/FormTextField'
import { useAppForm } from '../components/forms/useAppForm'
import { loginFormSchema } from '../schemas/authSchemas'

export function LoginPage() {
  const loginForm = useAppForm(loginFormSchema, {
    defaultValues: { email: '', password: '' },
  })

  function handleLoginSubmit(values) {
    console.log(values)
  }

  return (
    <AuthLayout variant="login">
      <AuthPageContent
        id="login-title"
        eyebrow="Your workspace awaits"
        title="Welcome back."
        description="Sign in and pick up right where you left off."
      >
        <AppFormProvider
          form={loginForm}
          onSubmit={handleLoginSubmit}
          aria-labelledby="login-title"
          className="space-y-lg"
        >
          <FormTextField
            name="email"
            label="Email address"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@company.com"
            icon={<Mail />}
            required
          />
          <div className="space-y-xs">
            <FormPasswordField
              name="password"
              label="Password"
              autoComplete="current-password"
              placeholder="Enter your password"
              required
            />
            <div className="flex justify-end">
              <Link to="/forgot-password" className="app-link inline-flex min-h-touch items-center text-sm">
                Forgot password?
              </Link>
            </div>
          </div>
          <FormSubmitButton pendingLabel="Signing in…">Sign in</FormSubmitButton>
        </AppFormProvider>
        <p className="mt-xl text-center text-sm leading-relaxed text-text-muted">
          New to BookMySku?{' '}
          <Link to="/register" className="app-link inline-flex min-h-touch items-center">Create an account</Link>
        </p>
      </AuthPageContent>
    </AuthLayout>
  )
}
```

**src/pages/RegisterPage.jsx**

```jsx
import { Building2, Mail, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../components/auth/AuthLayout'
import { AuthPageContent } from '../components/auth/AuthPageContent'
import { AppFormProvider } from '../components/forms/AppFormProvider'
import { FormPasswordField } from '../components/forms/FormPasswordField'
import { FormPhoneField } from '../components/forms/FormPhoneField'
import { FormSubmitButton } from '../components/forms/FormSubmitButton'
import { FormTextField } from '../components/forms/FormTextField'
import { useAppForm } from '../components/forms/useAppForm'
import { registerFormSchema } from '../schemas/authSchemas'
import { formatUSPhoneNumber, stripPhoneFormatting } from '../utils/phone'

export function RegisterPage() {
  const registerForm = useAppForm(registerFormSchema, {
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      organizationName: '',
      password: '',
      confirmPassword: '',
    },
  })

  function handleRegisterSubmit(values) {
    console.log({
      ...values,
      phone: formatUSPhoneNumber(values.phone),
      phoneDigits: stripPhoneFormatting(values.phone),
    })
  }

  return (
    <AuthLayout variant="register">
      <AuthPageContent
        id="register-title"
        eyebrow="Make room for what's next"
        title="Start something great."
        description="Create your account. Get your business in sync."
      >
        <AppFormProvider
          form={registerForm}
          onSubmit={handleRegisterSubmit}
          aria-labelledby="register-title"
          className="space-y-lg"
        >
          <div className="grid grid-cols-1 gap-lg sm:grid-cols-2">
            <FormTextField
              name="firstName"
              label="First name"
              autoComplete="given-name"
              placeholder="Alex"
              icon={<UserRound />}
              required
            />
            <FormTextField
              name="lastName"
              label="Last name"
              autoComplete="family-name"
              placeholder="Morgan"
              icon={<UserRound />}
              required
            />
          </div>
          <FormTextField
            name="email"
            label="Email address"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@company.com"
            icon={<Mail />}
            required
          />
          <FormPhoneField name="phone" label="Phone number" hint="US number · 10 digits" required />
          <FormTextField
            name="organizationName"
            label="Organization name"
            autoComplete="organization"
            placeholder="Your company or team"
            icon={<Building2 />}
            required
          />
          <FormPasswordField
            name="password"
            label="Password"
            autoComplete="new-password"
            placeholder="Create a strong password"
            hint="Use 8–128 characters with an uppercase letter, a lowercase letter, and a number."
            required
          />
          <FormPasswordField
            name="confirmPassword"
            label="Confirm password"
            autoComplete="new-password"
            placeholder="Enter your password again"
            required
          />
          <FormSubmitButton pendingLabel="Creating account…">Create account</FormSubmitButton>
        </AppFormProvider>
        <p className="mt-lg text-center text-sm leading-relaxed text-text-muted">
          Already have an account?{' '}
          <Link to="/login" className="app-link inline-flex min-h-touch items-center">Sign in</Link>
        </p>
      </AuthPageContent>
    </AuthLayout>
  )
}
```

**src/pages/AccountHelpPage.jsx**

```jsx
import { ArrowLeft, KeyRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../components/auth/AuthLayout'
import { AuthPageContent } from '../components/auth/AuthPageContent'

export function AccountHelpPage() {
  return (
    <AuthLayout variant="login">
      <AuthPageContent
        id="account-help-title"
        eyebrow="A little help getting back"
        title="Forgot your password?"
        description="Your organization’s administrator can help you recover access to your workspace."
      >
        <div className="flex items-start gap-md rounded-card border border-border-subtle bg-surface-muted p-lg">
          <KeyRound aria-hidden="true" className="mt-micro h-icon w-icon shrink-0 text-primary" />
          <p className="text-sm leading-relaxed text-text-muted">
            Contact your administrator using your organization’s usual support channel. Have the email address you use for BookMySku ready.
          </p>
        </div>
        <Link to="/login" className="app-link mt-lg inline-flex min-h-touch items-center gap-xs text-sm">
          <ArrowLeft aria-hidden="true" className="h-icon-sm w-icon-sm" /> Back to sign in
        </Link>
      </AuthPageContent>
    </AuthLayout>
  )
}
```

**tests/auth.spec.js**

```js
import { expect, test } from '@playwright/test'

test('login validates accessibly, toggles the password, and logs valid values', async ({ page }) => {
  const submittedValues = []
  page.on('console', async (message) => {
    if (message.type() === 'log') {
      submittedValues.push(await message.args()[0]?.jsonValue())
    }
  })
  await page.goto('/login')
  const email = page.getByLabel('Email address')
  const password = page.getByLabel('Password', { exact: true })
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(email).toBeFocused()
  await expect(email).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Enter your email address.')).toBeVisible()
  const descriptionId = await email.getAttribute('aria-describedby')
  expect(descriptionId).toBeTruthy()
  await expect(page.locator(`[id="${descriptionId}"]`)).toHaveText('Enter your email address.')
  await email.fill('alex@example.com')
  await password.fill('ExistingPassword1')
  await page.getByRole('button', { name: 'Show password', exact: true }).click()
  await expect(password).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Hide password', exact: true }).click()
  await expect(password).toHaveAttribute('type', 'password')
  await expect(email).toHaveAttribute('aria-invalid', 'false')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect.poll(() => submittedValues).toContainEqual({
    email: 'alex@example.com', password: 'ExistingPassword1',
  })
})

test('registration validates matching passwords and logs formatted and raw phone', async ({ page }) => {
  const submittedValues = []
  page.on('console', async (message) => {
    if (message.type() === 'log') submittedValues.push(await message.args()[0]?.jsonValue())
  })
  await page.goto('/register')
  await page.getByLabel('First name').fill('Alex')
  await page.getByLabel('Last name').fill('Morgan')
  await page.getByLabel('Email address').fill('alex@example.com')
  await page.getByLabel('Phone number').fill('(202) 555-0123')
  await expect(page.getByLabel('Phone number')).toHaveValue('202-555-0123')
  await page.getByLabel('Organization name').fill('Studio Goods')
  await page.getByLabel('Password', { exact: true }).fill('StrongPassword1')
  await page.getByLabel('Confirm password', { exact: true }).fill('DifferentPassword1')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByText('Your passwords do not match.')).toBeVisible()
  expect(submittedValues).toHaveLength(0)
  await page.getByLabel('Confirm password', { exact: true }).fill('StrongPassword1')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect.poll(() => submittedValues).toContainEqual({
    firstName: 'Alex', lastName: 'Morgan', email: 'alex@example.com',
    phone: '202-555-0123', phoneDigits: '2025550123', organizationName: 'Studio Goods',
    password: 'StrongPassword1', confirmPassword: 'StrongPassword1',
  })
})

test('phone accepts progressive input, caps paste, and supports editing across separators', async ({ page }) => {
  await page.goto('/register')
  const phone = page.getByLabel('Phone number')
  await phone.pressSequentially('2025')
  await expect(phone).toHaveValue('202-5')
  await phone.fill('2025550123999')
  await expect(phone).toHaveValue('202-555-0123')
  await phone.evaluate((input) => input.setSelectionRange(3, 3))
  await phone.press('Delete')
  await expect.poll(() => phone.evaluate((input) => input.selectionStart)).toBe(4)
  await phone.press('Delete')
  await expect(phone).toHaveValue('202-550-123')
  await phone.fill('123')
  await phone.press('Tab')
  await expect(page.getByText('Enter a 10-digit US phone number.')).toBeVisible()
})

for (const width of [320, 375, 768, 1024, 1440]) {
  for (const path of ['/login', '/register']) {
    test(`${path} fits a ${width}px viewport`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      if (width === 320 || width === 1440) {
        await expect(page.getByRole('heading', { level: 1 }).locator('xpath=../..')).toHaveCSS('opacity', '1')
        await expect(page.locator('input').last().locator('xpath=../..')).toHaveCSS('opacity', '1')
        await page.screenshot({ path: testInfo.outputPath('page.png'), fullPage: true })
      }
      await page.getByRole('button', { name: path === '/login' ? 'Sign in' : 'Create account', exact: true }).click()
      await expect(page.getByLabel('Email address')).toHaveAttribute('aria-invalid', 'true')
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    })
  }
}

test('reduced motion leaves fields visible and skips entrance and shake movement', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/login')
  const form = page.getByRole('form', { name: 'Welcome back.' })
  const email = page.getByLabel('Email address')
  await expect(email).toBeVisible()
  await expect(email.locator('xpath=../..')).toHaveCSS('opacity', '1')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(form).toHaveCSS('transform', 'none')
})

test('auth links navigate without leaving the application', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL('/login')
  await page.getByRole('link', { name: 'Create an account' }).click()
  await expect(page).toHaveURL('/register')
  await page.getByRole('link', { name: 'Sign in', exact: true }).click()
  await page.getByRole('link', { name: 'Forgot password?' }).click()
  await expect(page).toHaveURL('/forgot-password')
  await page.getByRole('link', { name: 'Back to sign in' }).click()
  await expect(page).toHaveURL('/login')
})
```

**Change the theme in one place**

Edit only `src/styles/theme.css` to change colors, fonts, type sizes, spacing, control sizes, radii, shadows, and focus styles. `tailwind.config.js` maps the semantic utility names to those variables. Tailwind 4 loads this mapping through its [documented `@config` directive](https://tailwindcss.com/docs/functions-and-directives#config). Components contain no authored inline styles or raw color values; Framer Motion manages its own animation styles.

**Reuse the fields in another form**

Define a Zod schema and pass it to `useAppForm`. Wrap the fields in `AppFormProvider`, supply `defaultValues`, and use each schema key as the field's `name`. `FormTextField` and `FormPhoneField` get their values, touched state, disabled state, and errors from RHF context. `FormPhoneField` formats typing and pasted values automatically. Text, password, and phone fields all share `FormLabel`; change label styling or markup in `src/components/forms/FormLabel.jsx` to update every field label in one place.

```jsx
import { z } from 'zod'
import { AppFormProvider } from './components/forms/AppFormProvider'
import { FormTextField } from './components/forms/FormTextField'
import { FormPhoneField } from './components/forms/FormPhoneField'
import { FormSubmitButton } from './components/forms/FormSubmitButton'
import { useAppForm } from './components/forms/useAppForm'
import { stripPhoneFormatting, usPhoneRegex } from './utils/phone'

const contactFormSchema = z.object({
  contactName: z.string().trim().min(1, 'Enter a contact name.'),
  phone: z.string().refine(
    (value) => usPhoneRegex.test(stripPhoneFormatting(value)),
    'Enter a 10-digit US phone number.',
  ),
})

export function ContactForm() {
  const contactForm = useAppForm(contactFormSchema, {
    defaultValues: { contactName: '', phone: '' },
  })

  function handleContactSubmit(values) {
    console.log({ ...values, phoneDigits: stripPhoneFormatting(values.phone) })
  }

  return (
    <AppFormProvider form={contactForm} onSubmit={handleContactSubmit} className="space-y-lg">
      <FormTextField name="contactName" label="Contact name" autoComplete="name" required />
      <FormPhoneField name="phone" label="Phone number" required />
      <FormSubmitButton>Save contact</FormSubmitButton>
    </AppFormProvider>
  )
}
```

Place the example in `src/ContactForm.jsx` so the relative imports resolve. The example is documentation only and is not added to the app's routes.

