# Frontend integration

Current integration targets the local backend `main` at `5b30872` (PRODUCT-01). Start future contract reviews at its maintained `docs/frontend-handoff.md`; module code and contracts outrank older checklist status. The initial integration used `4ec7a4f`. The `promoxcrm-webapp-prod` checkout supplies UI references: client overview/contact/address tabs, Supplier details and Product basic information/supplier selection. Its legacy authentication, dependencies, financial fields and endpoint shapes are not used.

## Current frontend update

- Clients: normalized prefix search and lifecycle filters; stable codes and account labels; optional website/industry through client-specific lookups; advisory duplicates; contact archive/restore and separate primary/billing defaults; canonical address geography/readiness; relationship, scoped manager selection, notes/corrections/version history and protected activity.
- Suppliers: codes and exact-code search, three independent capabilities including Fulfillment, optional profile fields, advisory duplicates, protected activity, required contact email and responsibilities, canonical addresses including Receiving, paginated default selection and explicit atomic child-create/default intent. Restore never reinstates old defaults.
- Products: `/app/products` and `/app/products/:productId` provide supplier-linked drafts, directory/filter/search, details/edit/copy/archive/restore and protected activity. Supplier selection is immutable on edit; copying requests a destination and a new explicit supplier item code or null. Leading zeros/case are preserved. Inline supplier creation retains the product draft. No activation, pricing, variants, media, stock, provider or order controls are exposed.
- Master Data: workspace category tabs, search, owner mutations and protected owner activity/per-entry history; platform saved draft editing, explicit publication comparison, publication detail/evidence, paginated versions and platform audit history. Publication affects future onboarding only. Existing copies and pinned onboarding are preserved.
- Setup: disabled optional resources settle without hanging; company addresses send `stateCode` and omit `region`. The backend's browser-compatible onboarding coordinator serializes saves/Finish using account-scoped Web Locks, checks account changes, reconciles uncertain outcomes, preserves revision conflicts for review and keeps commercial consent separate. Company drafts autosave after a pause. Journey waiting states use bounded polling/backoff, server retry timing and one tab lock; manual refresh remains available. Version-2 billing exposes explicit cancellation before access with retained invoice/recovery consequences.
- Shared dialogs guard dirty drafts on close, navigation and workspace switches. Uncertain business mutations retain their exact operation/body and offer an explicit retry. Revision review preserves entered values before using a current revision.

With assisted onboarding enabled, accepted organization owners can revisit company setup after activation without being sent through a regular owner application or ordinary subscription flow. Explicit editing can reopen completed, unlocked progress; locked provisioning remains read-only. This path has a separate mocked browser check with the rollout enabled.

## Super Admin and workspace access

Super Admin is resolved only by `/admin/me`, with the existing TOTP challenge for `ADMIN_MFA_REQUIRED`. Administration is rendered only for a verified `super_admin` response. Normal workspace navigation does not advertise platform administration. Platform templates/history stay under `/admin`; Super Admin status never creates a tenant membership or bypasses workspace access.

Workspace owners manage their own team, roles and billing. Non-owner members use explicit effective grants. Master Data reads require enabled `master_data.view`; writes and workspace history remain owner-only. Product archive/restore/history have separate grants. All business writes also require current server `writesAllowed`; restricted billing preserves authorized reads. API authorization remains authoritative after every request/retry.

## Screens and contracts

| Route                                      | Integrated behavior                                                                                                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/login`, `/register`, `/auth/callback`    | Supabase PKCE authentication, email confirmation, six-field applications, review status, rejected corrections, current terms                                                   |
| `/setup`, `/onboarding`, `/billing/return` | Exact server offer, recurring consent, Checkout/recovery, company progress/completion, activation status                                                                       |
| `/app`                                     | Organization discovery, workspace selection, effective permissions, billing access, overview                                                                                   |
| `/app/clients`                             | Name-only creation, case-sensitive name-prefix search, cursor pagination                                                                                                       |
| `/app/clients/:id`                         | Rename, nested contacts, address books, defaults and independent copies                                                                                                        |
| `/app/team`                                | Owner invitation/member lists, invite, resend, cancellation, role changes and revocation                                                                                       |
| `/team/accept`                             | Fragment removal, in-memory token during sign-in, acceptance without another subscription                                                                                      |
| `/app/roles`                               | Owner role editor using catalog-supported grants/scopes, archive and assignment                                                                                                |
| `/app/billing`                             | Owner billing status, reconciliation and recovery                                                                                                                              |
| `/admin`                                   | Platform authorization, authenticator enrollment/challenge, application review, draft offers, plan versions/history, permission catalog, billing status and extension previews |

The HTTP client appends paths to `VITE_API_BASE_URL`, which must include `/api/v1`. Local development uses `/api/v1` through Vite's proxy to `API_PROXY_TARGET` (default `http://127.0.0.1:3000`). The existing local `.env` is unchanged. Supabase URL/publishable key must match the backend identity provider. Set Stripe return URLs to `/billing/return` (or `/setup`) and email invitation links to `/team/accept` on the correct frontend origin. Serve `index.html` for application routes when hosting a static build.

## Shared behavior

- `src/styles/theme.css` owns semantic colors, typography, spacing, shadows, and both palettes. Theme preference persists, defaults to the system setting, and works when browser storage is unavailable. Authentication and workspace surfaces and loading placeholders use solid colors.
- Workspace records and permissions stay in memory, scoped to the authenticated account and selected organization. Organization switches remount workspace pages. Logout/account changes discard operation intents. Denied requests refresh permissions/access; there is no legacy-role fallback. Business writes also require server `writesAllowed`.
- Mutation UUIDs are retained with the exact request after uncertain responses. Dialogs lock uncertain drafts for retry; completed operations discard their key. Reload and review conflicts before changing revisions. A full browser restart discards ordinary in-memory drafts; reload current records before a new edit. Checkout has server recovery across restarts and does not need the original browser key to recover an existing session.
- Payment links are restricted to HTTPS Stripe Checkout or supported hosted invoice URLs. URL success flags never establish payment/activation. Offer conflicts reload terms and clear consent. Money displays use server minor-unit amounts; the frontend does not compute eligibility, discounts, proration, tax, or invoice totals.
- Errors show safe messages and support request IDs. Forms, tokens, fragments, and payment links are not logged. Invitation tokens and private payment URLs never enter durable browser storage. Supabase manages its own sign-in persistence.
- Platform access comes from `/admin/me`, separately from workspace ownership. `ADMIN_MFA_REQUIRED` opens an authenticator challenge, including expiry during an action. The server determines freshness.

## Scope and verification

The backend exposes supplier directories and product drafts. Product activation/pricing/media/stock, projects, orders, invoice creation, exports and hard client deletion remain outside this integration. Customer database selection and SAGE are deferred by the handoff. Password recovery uses Supabase email recovery and `/reset-password`.

Validation uses lint, a production build, and Playwright with test-only Supabase values and mocked API contracts. Browser tests use port 5174 so an existing dev server on 5173 stays available. They cover auth, exact writes, safe retries, workspace switching, permission removal, billing restrictions, cursors, contact conflicts, shared addresses, offer consent, payment recovery, unsafe redirects, setup revisions, invitation handling, and both themes on mobile/desktop.

Local `/health/ready` returned HTTP 200. This does not validate live sign-in, tenant authorization, email delivery, database transactions, or Stripe compatibility. Complete the backend handoff's real-provider acceptance flow in staging before release. No backend migration, customer-data change, deployment, merge, or push is included.

For Windows runs where automatic dev-server teardown stalls, an explicitly started test-only server on port 5174 can be reused with `PLAYWRIGHT_REUSE_TEST_SERVER=true`. Start it with the test Supabase URL/key and `/api/v1` from `playwright.config.js`, then stop it after testing. Reuse is off by default; never point mocked browser tests at an ordinary signed-in dev session. This is a test orchestration option, not a deployment setting.

The current update passed lint, production build and all 78 Playwright checks using mocked providers. The full browser run used `--trace=off` because retaining temporary trace frames stalled cleanup in this Windows/OneDrive checkout; assertions were unchanged. Default trace retention remains available for diagnosis. A separate rollout-enabled browser check verified active assisted company editing without ordinary application/billing calls. These checks do not qualify real Supabase, SMTP, Stripe or a deployed schema.

## Backend main update at `e70966f`

The frontend now includes the backend features added after `4ec7a4f`:

- `/app/suppliers` and `/app/suppliers/:supplierId` use the organization-scoped supplier directory, child contacts and addresses, and explicit defaults. Navigation/actions follow current `suppliers.view`, `suppliers.create`, and `suppliers.edit` grants. No product catalog or purchasing flow is exposed.
- `/app/master-data` reads and edits the workspace's industry, product-category, and decoration-method entries. `/admin` adds platform template draft editing and explicit publication; a valid published bundle is still required before new workspace activation.
- `/continue` reads `/onboarding/journey` and routes from its `nextAction`. Login and email confirmation use this route. Pending invitations are kept out of the owner application path.
- Version-2 billing accounts use explicit workspace preparation and the separate `billing/start` consent action. Version-1 remains on the existing activation flow.
- `/assisted/accept` captures and removes the invitation fragment before sign-in, supports account-only signup, verifies terms/email in the backend, and submits the acceptance token only in the authenticated request. `/assisted` displays owner agreement and seat-request flows using the server's billing preview.
- `/admin` adds separate email-verification intake and assisted-onboarding tabs. Assisted onboarding is opt-in and requires `VITE_ASSISTED_ONBOARDING_ENABLED=true` in a frontend deployment whose backend has the matching rollout enabled. Its API rollout defaults off.
- `VITE_REGISTRATION_HOOK_ENABLED=true` selects the single-form Supabase signup path. Configure `VITE_REGISTRATION_TERMS_VERSION` to the current backend value and `VITE_REGISTRATION_TERMS_URL` to the published terms page. Keep this flag off until the signed registration hook, reconciliation worker, SMTP, and provider settings are qualified.

The current UI build is code-level validation only. Live Supabase, email delivery, Stripe test clocks, backend schema release, and rollout configuration remain staging requirements; no live provider or deployment is claimed.
