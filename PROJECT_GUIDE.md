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
| `SingleUploader` | One-file dropzone + preview | see **File uploaders** below |
| `MultipleUploader` | Multi-file library + cover actions | see **File uploaders** below |

Import: `import { Button, TextLink, MultipleUploader } from '@/components/common'`

Rules: actions → `Button`; normal nav → `TextLink`; intentional CTA nav → `ButtonLink`. Prefer `<button>` / `<a>` / `<Link>` semantics.

### File uploaders (`src/components/common/uploader/`)

Shared, module-agnostic. Transport is injected — do **not** hard-code multipart if the API uses another contract (Products media uses intent + raw `PUT`).

#### `filePlaceholder`
```js
{
  label: 'Upload product images',
  accept: ['image/jpeg', 'image/png', 'image/webp'],
  hint: 'JPG, PNG or WEBP, max 10MB',
}
```
Drives visible label, `<input accept>`, and client validation. Invalid files never enter the list.

#### `SingleUploader` props
| Prop | Type | Notes |
|------|------|--------|
| `filePlaceholder` | `FilePlaceholder` | required |
| `value` | `UploadFileItem \| null` | current file |
| `onChange` | `(item \| null) => void` | local/upload updates |
| `uploadFile` | `(file, { signal, onProgress }) => Promise` | optional auto-upload |
| `maxSizeMB` | `number` | default `5` |
| `disabled` | `boolean` | |
| `error` | `string` | external error |
| `label` | `string` | |
| `onRemove` | `() => void` | when removing a remote `value` |

#### `MultipleUploader` props
| Prop | Type | Notes |
|------|------|--------|
| `filePlaceholder` | `FilePlaceholder` | required |
| `existing` | `UploadFileItem[]` | already on server |
| `uploadFile` | same as single | required for auto-upload |
| `maxFiles` | `number` | default `8` |
| `maxSizeMB` | `number` | default `5` |
| `disabled` / `error` / `label` | | |
| `onRemove` | `(item) => void` | remote remove / clear cover |
| `onSetCover` | `(item) => void` | show **Set as cover** |
| `onBusyChange` | `(busy: boolean) => void` | disable save while uploading |
| `onUploaded` | `() => void` | e.g. reload list |

Helpers: `validateFile` / `validateFiles`, `formatFileSize`, `useFileUpload`.

#### Use in a new module (3 steps)
1. Define a `filePlaceholder` (accept list + hint) and, if needed, an `uploadFile` adapter for your API.
2. Render `SingleUploader` or `MultipleUploader` with `maxSizeMB` / `maxFiles` matching the backend.
3. Map server records into `UploadFileItem` (`remote: true`, `status: 'uploaded'`, `previewUrl`) and handle `onRemove` / `onSetCover` with your association/delete routes.

Products Images tab example: [`src/pages/workspace/ProductMedia.jsx`](src/pages/workspace/ProductMedia.jsx) (PRODUCT-03: `POST …/media/intents` → `PUT …/content` → `POST …/association`).

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
| `/app/products`, `/app/products/:id`, `/app/products/:id/edit` | Products (Custom Product) |
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

## Redux — custom products (Products)
- Slice: `src/store/customProductSlice.ts` — `products`, `loading`, `error`, `loaded`, `organizationId`
- Type: `CustomProduct` in `src/types/customProduct.ts`
- API: `src/services/customProductApi.ts` (`customProductPaths`, list/get/create/update/archive/restore/copy)
- Hook:
  ```js
  const { products, loading, error, refetch, saveProduct } = useCustomProducts()
  ```
- `useCustomProducts()` auto-fetches all pages (`status=all`); skips duplicate fetch per org
- After create/edit/archive/restore/copy: `saveProduct(product)` to sync the store

## Custom Product section
| Piece | Path / role |
| ----- | ----------- |
| List | `CustomProductsPage.jsx` → `/app/products` |
| Detail | `CustomProductDetailPage.jsx` → `/app/products/:id` (Overview + Variants/Images/Pricing/Activity tabs) |
| Edit | `CustomProductEditPage.jsx` → `/app/products/:id/edit` |
| Form (create dialog) | `components/customProducts/CustomProductForm.jsx` |
| Shared fields | `CustomProductFormFields.jsx` |
| Table / row / search | `CustomProductTable.jsx`, `CustomProductRow.jsx`, `CustomProductSearch.jsx` |
| Copy | `CustomProductCopy.jsx` |
| Schema | `schemas/customProductFormSchema.js` |

### Add a new product field (short)
1. Extend `CustomProduct` in `src/types/customProduct.ts`
2. Add Zod rule + `productToFormValues` / `buildCustomProductPayload` in `customProductFormSchema.js`
3. Add the input in `CustomProductFormFields.jsx`
4. Show it on detail overview in `CustomProductDetailPage.jsx` if it should display

### Variant editing
The Variants tab uses `ColorSizeEditor.jsx` for products with Color/Colour and/or
Size options, including unconfigured and standard products. Each field has an Add
button and removable values; Enter adds a value. Saving also includes any value
still typed in a field. Empty Color and Size lists save single mode. Existing
dimension/value IDs and supplier identification are preserved. Configuration is
saved through the existing revision-checked `/configure` command; combinations
are added explicitly in `VariantEditor.jsx`, with part code and packaging under
optional details. Existing products with other dimensions keep the generic
`ConfigurationEditor.jsx`. Structural edits remain draft-only; active products
keep their correction flow. Pricing is unchanged.

## Products Pricing tab

`ProductPricing.jsx` opens `PriceTableEditor.jsx` using `GET/POST /pricing/tables`.
The simple editor displays a compact row per quantity with Cost, Margin %, Price
and Margin (profit per item); mobile rows wrap without horizontal scrolling.
Table names, applicability and extra tables are under collapsed Pricing options.
Save is enabled after edits, with a visible unsaved/saved state.
`src/utils/priceTable.js` uses exact six-place decimal
arithmetic matching the backend; only the last price/margin edit intent is sent.
Save submits the whole table set with the returned product/source revisions.
An uncertain save locks edits and retries the original payload and UUID.
Costs and margins require cost access; writes also require product/pricing edit
access and unrestricted billing. Draft/current status follows the Save receipt.
The UI supports all-current or selected variant applicability without editing
variant records. Existing pricing returning `PRICE_TABLE_ADOPTION_REQUIRED`
retains the schedule workflow below; conversion is a separate backend operation.
Styles are scoped in `components/productPricing/price-tables.css`.

### Legacy schedule workflow (PRODUCT-04)
The current variant and pricing flow follows backend corrections/packaging (#133)
and exact part-code lookup (#151). Options use readable names with generated,
stable keys. Packaging edits explicitly send `baseUnit: "item"`. Active variants
can be corrected with a reason and same-item confirmation; structural changes
remain draft-only.

The main pricing editor shows inclusive **From / Through** quantities and maps
Through to the API's exclusive upper bound. Preserve decimal strings, null versus
zero, and optional tier `netBasis` (`base_item` or `procurement_unit`) on every
edit. Supplier costs can be per purchase unit; premiums and sales remain per item.
New price lists default the local account/warehouse labels to `standard`/`default`;
these are editable under Account and warehouse labels.

`PricingAdoptionDialog.jsx` reviews selected published versions through
`POST /pricing/adoption-preview` and creates independent drafts through
`POST /pricing/adoptions`. Preserve each target's UUID on uncertain/partial
retries and show per-target results. Publication is a separate reviewed action.
Historical preview explicitly sends `versionId` and uses retained variants and
packaging. Current preview keeps stale-source checking and explicit refresh.

Pricing is a **separate schedule API** (not saved with product create/update). Base path: `{org}/products/{id}/pricing`.

| Piece | Path / role |
| ----- | ----------- |
| Main tab | `components/productPricing/ProductPricing.jsx` (imported directly by the detail page) |
| Schedule list / row / cards | `PricingScheduleList.jsx`, `PricingScheduleRow.jsx` |
| Summary | `PricingSummary.jsx` |
| Draft editor | `ScheduleEditor.jsx` (controlled + `useMutation` idempotency) |
| Tier / variant fields | Inline in `ScheduleEditor.jsx`; choices use `PricingVariantSelect.jsx` |
| Publish / preview | `PublicationDialog.jsx`, `GoodsPreview.jsx`, `RateSummary.jsx` |
| Types | `src/types/pricing.ts` (preview requests/results and schedule kinds) |
| Validation | `src/schemas/pricingFormSchema.js` |
| API | `src/services/pricingApi.ts` (used pricing paths and preview requests); saves use `useMutation` |
| Display helper | `src/utils/formatPrice.ts` |

### Add a new pricing field (short)
1. Extend the Zod object in `pricingFormSchema.js`; update `src/types/pricing.ts` if the field affects a preview request or response.
2. Map it in `normalizePricingRules` / form defaults inside `ScheduleEditor.jsx`.
3. Add the input in `ScheduleEditor.jsx` and its read-only display in `RateSummary.jsx` as needed.
4. Confirm the backend contract still accepts the field — do not invent fields the API rejects.

## Theme / styling

- **Single source:** `src/crm-theme/tokens.css` owns light/dark colors, glass opacity/blur/borders, typography, spacing, radius, shadows, motion, layers, and the shared canvas atmosphere.
- **Palette:** Slate (`#0F172A`) in the default dark mode, cool slate (`#F1F4F9`) in light mode, and Peach (`#D99869`) primary actions from the local Glassmorphism design repository. The canvas uses the reference's three subtle peach radial glows. `primary-ink` supplies readable link/icon text on each surface; `on-primary` supplies dark text on peach fills.
- **Shared appearance:** `src/crm-theme/components.css` styles cards, controls, tables, tabs, navigation, modals, editors, and uploaders, including existing page class names. Layout remains in `src/styles/`.
- **Class exports:** `import { theme } from '@/crm-theme'`; use `theme.glassCard`, `glassPanel`, `glassModal`, `button.primary/secondary/danger/ghost/icon`, `input`, `select`, `tableHeader`, `tableRow`, `tabs`, `sidebarItem`, and `sidebarItemActive`. `card`, `panel`, and `modal` remain aliases.
- **Glass classes:** `.glass-card`, `.glass-panel`, `.glass-modal`, `.glass-dropdown`; legacy `.panel`, `.sidebar`, `.topbar`, and `.app-dialog` share the same rules. The design repository's Strong preset uses 18% white glass, 32px blur, 25% white borders, and 200% saturation in dark mode; headers/overlays use 44px blur. Table panels retain glass; nested panels and table scroll containers avoid additional blur. Unsupported browsers receive opaque surfaces.
- **Tailwind:** `tailwind.config.js` maps CSS tokens; no separate palette literals. `colors.ts` exports active-theme CSS references, including the legacy light/dark export names, rather than duplicated RGB values.
- **Accessibility:** Essential text is at least 12px, primary buttons use contrast-safe foregrounds, required stars are decorative CSS, and keyboard focus, reduced motion, native dialogs and menu behavior are preserved.

### Change the theme (4 steps)

- Edit `:root` and `.dark` values in `src/crm-theme/tokens.css`; existing theme persistence remains unchanged.
- Adjust glass, typography, spacing, radius or motion tokens in that same file.
- For a shared component treatment, edit `components.css` and its export in `classes.ts`; reuse common components on pages.
- Run `npm run build` and the relevant Playwright checks, reviewing desktop/mobile screenshots in both modes and checking contrast/fallbacks.

## Add a page / component
1. Create small component under `src/components/...` or screen under `src/pages/...` (<150 lines when possible).
2. Reuse `common/` primitives; put theme classes via `theme.*`, not one-off colors.
3. Wire route in `src/App.jsx` (lazy import + Suspense already set).
4. Data: `useResource('/path')` / `useMutation` + `api`/`mutate` — match backend response shape.
5. Links = `TextLink`/`ButtonLink`; actions = `Button`. Update this guide’s tables if you add a shared primitive or route.
