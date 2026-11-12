# BookMySKU Frontend Guide

## Folders
| Path | Role |
|------|------|
| `src/pages/` | Route screens (auth, setup, admin, workspace) |
| `src/components/common/` | Shared UI primitives (prefer these) |
| `src/components/workspace/` | Workspace-only widgets + `Elements` adapters |
| `src/components/admin/` | Admin shell / nav |
| `src/components/auth/` | Auth forms / brand |
| `src/components/ui/` | Legacy UI kit (re-exports / extras: Spinner, ThemeToggle) |
| `src/crm-theme/` | Colors, CSS tokens, Tailwind class strings |
| `src/services/` | HTTP + auth + workspace helpers |
| `src/hooks/` | Data/auth hooks |
| `src/utils/` | Shared helpers (`debounce`, format, phone) |
| `src/styles/` | Workspace/admin CSS |
| `src/schemas/` | Form/validation schemas |

## Debounce (reuse everywhere)
- Function (any JS): `import { debounce } from '@/utils/debounce'` → `debounce(fn, 400)` (+ `.cancel()` / `.flush()`)
- React value: `useDebouncedValue(value, 400)` — search inputs, duplicate checks
- React callback: `useDebouncedCallback(fn, 400)` — event handlers without recreating timers

## Common components (`src/components/common/`)
| Name | Job | Main props |
|------|-----|------------|
| `Button` | `<button>` actions | `variant` primary\|secondary\|danger\|ghost\|icon, `size`, `type` |
| `ButtonLink` | Nav that must look like a CTA button | `to` or `href`, `variant` |
| `TextLink` | Inline text link | `to` or `href` |
| `PageHeader` | Page title block + document title | `eyebrow`, `title`, `description`, `actions` |
| `EmptyState` | Empty list/page placeholder | `title`, `description`, `action`, `icon` |
| `Loader` / `PageLoader` | Inline / full-page loading | `label` |
| `Card` | Simple panel surface | `as`, `className` |
| `Badge` | Status chip | `tone` default\|primary\|success\|warning\|danger\|info |
| `TextField` | App-wide text input | `label`, `hint`, `error`, `icon`, input attrs |
| `SelectField` | App-wide select (same size as TextField) | `label`, `hint`, `error`, `children` options |
| `Input` / `Select` | Aliases of TextField / SelectField | same |
| RHF: `FormTextField` / `FormSelectField` | `src/components/forms/` | `name` + TextField/SelectField chrome |
| `Modal` | Re-export of workspace `Dialog` | same as `Dialog` |

Import: `import { Button, TextLink } from '@/components/common'`

Rules: actions → `Button`; normal nav → `TextLink`; intentional CTA nav → `ButtonLink`. Prefer `<button>` / `<a>` / `<Link>` semantics.

## Routing (`src/App.jsx`)
| Path | Page |
|------|------|
| `/login` | LoginPage |
| `/register` | RegisterPage |
| `/auth/callback` | AuthCallbackPage |
| `/forgot-password` | AccountHelpPage |
| `/reset-password` | ResetPasswordPage |
| `/continue` | ContinuePage (signed-in router) |
| `/setup` | SetupPage |
| `/assisted`, `/assisted/accept` | AssistedPage |
| `/team/accept` | InvitationPage |
| `/admin` | AdminPage (+ `?section=`) |
| `/app` | Workspace (Overview) |
| `/app/clients`, `/app/clients/:id`, `/app/clients/:id/edit` | Clients |
| `/app/suppliers`, `/app/suppliers/:id` | Suppliers |
| `/app/products`, `/app/products/:id` | Products |
| `/app/decoration-matrices`, `.../:id` | Decoration |
| `/app/master-data` | Master data |
| `/app/team`, `/app/roles`, `/app/billing` | Team / roles / billing |

## API layer
- Base URL: `VITE_API_BASE_URL` or `/api/v1` (`src/services/api.js`)
- Auth: Supabase client in `src/services/auth.js`; bearer attached via `setAccessTokenProvider`
- Reads: `useResource(path)` → `api.get`
- Writes: `useMutation` + `mutate()` in `src/services/workspace.js` (idempotency / conflict helpers)
- Journey: `useJourneyStatus` → onboarding status for continue/setup
- Typical paths: `/admin/me`, `/onboarding/me`, `/applications/:id/billing`, org-scoped workspace CRUD under selected org base URL

## Redux — clients
- Store: `src/store/index.ts` (Provider in `src/main.jsx`)
- Slice: `src/store/clientSlice.ts` — `clients`, `loading`, `error`, `loaded`, `organizationId`
- Type: `Client` in `src/types/client.ts` (reuse everywhere)
- Selectors: `selectClients`, `selectClientsLoading`, `selectClientsError`, `selectClientsLoaded`, `selectClientsOrganizationId`
- Hook:
  ```js
  const { clients, loading, error, refetch, saveClient } = useClients()
  // force refresh: refetch()
  // after create/edit: saveClient(client)
  ```
- `useClients()` auto-fetches when list empty / org changed; skips duplicate fetch if already loaded for current org
- Client list API lives only in `fetchClients` thunk (pages through `state=all`)

## Client section components
- `src/pages/workspace/ClientsPage.jsx` — list page
- `src/pages/workspace/ClientDetailPage.jsx` — detail + contacts tabs
- `src/components/clients/ClientTable.jsx` / `ClientRow.jsx` / `ClientSearch.jsx` / `ClientForm.jsx` / `ClientFormFields.jsx`
- Add = dialog `ClientForm`; Edit = page `ClientEditPage` (`/app/clients/:id/edit`); shared fields in `ClientFormFields`
- Tab editors (RHF): `ContactEditor`, `AddressEditor`, `ManagementEditor`, `NoteEditor`
- Activity: `src/utils/activityDisplay.js` formats labels and hides MongoDB ids
- Forms: `useAppForm` + client/contact/tab schemas
- Related: `ClientManagement.jsx`, `ClientAddresses.jsx`, `ClientActivity.jsx`, `ClientContactDefaults.jsx`

## Theme / styling
1. Tokens + CSS vars: `src/crm-theme/tokens.css` (imported by `theme.css`)
2. Class strings: `src/crm-theme/classes.ts` → `import { theme } from '@/crm-theme'`
3. Colors: `src/crm-theme/colors.ts`
4. Layout CSS: `src/styles/workspace.css`, `src/styles/admin.css`
5. Global utilities: `src/index.css` (`.app-link`, `.glass`)

## Add a page / component
1. Create small component under `src/components/...` or screen under `src/pages/...` (<150 lines when possible).
2. Reuse `common/` primitives; put theme classes via `theme.*`, not one-off colors.
3. Wire route in `src/App.jsx` (lazy import + Suspense already set).
4. Data: `useResource('/path')` / `useMutation` + `api`/`mutate` — match backend response shape.
5. Links = `TextLink`/`ButtonLink`; actions = `Button`. Update this guide’s tables if you add a shared primitive or route.