# BookMySku

React workspace for clients, contacts, addresses, teams, roles, onboarding, and billing, with a centralized light/dark theme and solid surfaces throughout. Built with JavaScript, Vite, Tailwind CSS, React Hook Form, Zod, and Framer Motion.

See [Frontend integration](docs/FRONTEND_INTEGRATION.md) for the current screen/API map, backend reference revision, retry behavior, and verification limits.

Copy `.env.example` to `.env` and configure the public Supabase URL and publishable key from the same project used by the backend. Install dependencies and start the frontend:

```sh
npm install
npm run dev
```

Open `http://localhost:5173/login`. The frontend uses port 5173 and proxies `/api` to the backend on port 3000. Set `API_PROXY_TARGET` if the backend runs elsewhere. For a deployed frontend, set `VITE_API_BASE_URL` to the backend URL including `/api/v1`, and redeploy after changing build variables. Keep `.env` out of Git.

Registration follows the current backend `docs/frontend-handoff.md` and `docs/supabase-auth-setup.md`:

1. Create an email/password sign-in through Supabase and confirm the email in the same browser. The PKCE callback is `/auth/callback`.
2. Read `/onboarding/me` with the current SDK access token to load existing applications and the current terms version.
3. Submit the six contact/company fields, accepted terms and server-provided terms version to `/onboarding`. Passwords go only to Supabase. Application email matches the verified sign-in email.
4. Show pending/approved/rejected status. Rejected applications can be corrected with the current `expectedRevision`; pending applications cannot be edited.

Supabase must allow the exact confirmation callback for each frontend origin, for example `http://localhost:5173/auth/callback`. Enable email/password signup and email confirmation in that project. Use the same browser for the PKCE confirmation link. Do not expose service-role keys, database credentials or per-user tokens as build variables.

The backend must already expose its authenticated API. A healthy `/health/ready` response alone does not imply onboarding is enabled: a backend running with `TENANT_API_ENABLED=false` returns 404 for onboarding. Backend configuration is managed separately; this frontend change does not alter it. Approval, billing, company setup and workspace activation remain separate backend stages; the UI now follows those stages through the workspace screens documented in the integration guide.

`src/services/api.js` exposes Axios `get`, `post`, `put`, `patch`, and `delete` methods in two groups. `api` reads the current Supabase session token per request; `headerlessApi` omits Authorization for public endpoints. On 401, protected requests refresh the session once. Writes replay only with their original body and operation key. Registration reuses its UUID after uncertain responses and requires fresh acceptance when terms change.

```js
import { api } from './services/api'

await api.get('/onboarding/me')
await api.post('/onboarding', payload, { idempotencyKey: crypto.randomUUID() })
```

Run checks:

```sh
npm run lint
npm run build
npm run test:e2e -- --workers=4
```

Browser tests use locally installed Google Chrome and mocked Supabase/backend responses with test-only environment values. They do not send real confirmation emails or validate live onboarding. Playwright runs its isolated test server on port 5174, leaving an existing frontend on port 5173 available.

Edit `src/styles/theme.css` to update the theme and `src/components/forms/FormLabel.jsx` to update shared field labels. [AUTH_IMPLEMENTATION.md](AUTH_IMPLEMENTATION.md) contains the original reusable form examples; the maintained backend handoff defines the current integration contract.
