# auth.outboundendurance.com

## Authentication setup

Better Auth uses `BETTER_AUTH_SECRET` and `BASE_URL`. Set a unique random
secret of at least 32 characters and the public base URL of this service in an
ignored environment file or the deployment platform's secret settings. The
local URL is `http://localhost:3000`.

## Email OTP

Better Auth sends six-digit sign-in codes through Resend. Configure
`RESEND_API_KEY` and `RESEND_FROM_EMAIL` in `.env.local` or the deployment
platform's secret settings. The sender address must be verified with Resend.
Codes expire after 10 minutes and allow up to five verification attempts.
The sign-in page creates an account when a new email successfully verifies its
first code. Return URLs are limited to the auth service and, in production,
`outboundendurance.com` and all HTTPS subdomains of that domain; local
development allows any `localhost` port.

Run the return URL tests with:

```sh
bun run test
```

## Database setup

The database uses Turso/libSQL with Drizzle ORM. For local development, copy
`.env.example` to `.env.local`; the default URL uses a local `local.db` file and
does not need an auth token.
Locally generated row IDs use database-generated integers. Better Auth returns
these IDs as strings to the application; Stripe object IDs remain unique strings.
Billing data is stored separately from authentication: `stripe_customer` maps
users to Stripe customers, `stripe_subscription` stores subscription state,
and `stripe_event` records successfully processed webhook event IDs.

For a Turso database, set `TURSO_DATABASE_URL` to its libSQL URL and
`TURSO_AUTH_TOKEN` to a database token. Keep the token in an ignored environment
file locally and in the deployment platform's secret settings.

Check the configured connection with:

```sh
bun run db:check
```

Seed an idempotent development admin user into a local `file:` database with:

```sh
bun run db:seed
```

The seed command refuses remote databases and does not create Stripe or email
records. Apply migrations before running it.

After changing `lib/db/schema.ts`, generate and apply migrations with:

```sh
bun run db:generate
bun run db:migrate
```

Review and commit generated files in `drizzle/`. Apply migrations to the
intended database explicitly; the commands use the same environment variables
as the application.

## Vercel environment variables

Create `.env.production` and `.env.preview` in the repository root.
Use separate auth secrets, Stripe keys, and Turso databases; the build command
runs migrations and Stripe setup for the selected Vercel environment. These
files are ignored by Git. Do not commit them or copy Production credentials into
Preview.
Set `LOG_LEVEL` in both files before running the environment uploader; use
`warn` for Production and a more verbose level such as `info` for Preview.

Set `VERCEL_TOKEN` and `VERCEL_PROJECT_ID` in each selected `.env.preview` or
`.env.production` file. For a team project, also set `VERCEL_TEAM_ID`; it may
remain empty for a personal project. These uploader settings are listed in
`.env.example` but are local-only and are never uploaded to Vercel. The token
must have permission to manage environment variables for the project. Find the
project and team IDs in the Vercel project settings. Then validate and upload
each environment. The sync commands load the selected file into `process.env`
using Bun's `--env-file` flag, and the uploader validates its own inputs:

```sh
bun run sync:env:preview -- --check
bun run sync:env:preview
bun run sync:env:prod -- --check
bun run sync:env:prod
```

The uploader compares the selected file and `.env.example` with Node's built-in
`.env` parser; it fails before making changes unless the files have exactly the
same variable names and all application values are non-empty. It uses Vercel's
official `@vercel/sdk` to list the selected environment's variables, remove
them by ID, and recreate the file's variables as encrypted values. Variable
values and the access token are not printed. `--check` performs validation and
API reads without making changes. The uploader also stops if Vercel reports
hidden production variables or a paginated list, rather than risk syncing an
incomplete set. Keep Production and Preview credentials and databases
separate, and use Stripe live keys for Production and test keys for Preview.
Variables shared with another Vercel environment cause the sync to stop rather
than delete that other environment's configuration.

Each non-check env sync also recreates the Stripe webhook for the selected
environment. It deletes every endpoint in that Stripe mode whose URL exactly
matches `BASE_URL` plus `/api/stripe/webhook`, then creates a fresh endpoint
with the application's required events. The generated signing secret is added
to the Vercel environment as an encrypted `STRIPE_WEBHOOK_SECRET`; it is never
read from or written to an env file. `--check` only reports matching endpoints
and does not delete or create them. Syncing Vercel variables does not trigger a
deployment; the next normal deployment uses the newly uploaded secret.

## Application logging

The application uses Pino for structured server logs. `LOG_LEVEL` accepts
`fatal`, `error`, `warn`, `info`, `debug`, `trace`, or `silent`; it defaults to
`warn` in production and `debug` elsewhere. Vercel log levels are preserved by
routing each level through the corresponding console method.

## Stripe Checkout

Set `STRIPE_SECRET_KEY` in `.env.local` or the deployment platform's secret
settings. Define the product name, description, amount (in minor currency
units), currency, and recurring interval in
`lib/stripe-catalog-definition.ts`. Replace all `REPLACE_WITH_` values and set
the price amount before deploying; the sync command rejects unfinished
placeholders.

`bun run stripe:catalog:sync` finds the product by its stable Stripe metadata
marker (or by the configured name on first sync), creates it if it is missing,
and finds or creates the matching recurring price. It stores the resolved
product and price IDs plus the display details in `stripe_catalog`, separately
for test and live mode. Run it as part of `bun run deploy:prepare`, or manually
after changing the catalog definition. The pricing and checkout requests read
this record and do not make Stripe product or price lookup requests.

`/subscribe` requires sign-in. Users without an `active` or `trialing`
subscription see the current price and one Subscribe button. Existing customers
with a manageable subscription are sent to `/manage`, which opens the Stripe
Billing Portal. `/account` remains as a compatibility redirect to `/subscribe`.
`POST /api/billing/checkout-session` creates a Stripe-hosted Checkout Session
for the synchronized price; the client cannot choose a different price, and
users with paid access cannot start another subscription. The session stores
the validated `returnTo` URL and user ID in Checkout metadata. Stripe returns
the browser to `/billing/return` with the Checkout Session ID; the return page
retrieves the metadata from Stripe and polls for the entitlement update from
the webhook. It redirects to `returnTo` only after entitlement is confirmed.

Consuming apps should make the access check server-to-server, then redirect the
user's browser to the auth site with the originally requested page in its
`returnTo` query parameter if the check returns `401` or `403`. A `401` requires
sign-in; a `403` requires sign-in and an eligible subscription. After the user
completes any required steps, the auth site returns the browser to that page.
The consuming app should repeat its server-to-server access check on arrival.
Return URLs are limited to the auth service and, in production,
`outboundendurance.com` and its HTTPS subdomains.

The app manages its Customer Portal configuration through the Stripe API.
`bun run build` only builds the app. Configure the deployment to run
`bun run deploy:prepare` as its pre-deploy or release command, followed by
`bun run build`:

```sh
bun run deploy:prepare
```

This applies migrations, synchronizes the code-defined product and price, then
syncs the Billing Portal configuration. Provide the deployment's database
credentials and Stripe secret key to this step, and run it before the new app
version receives traffic. Use a test-mode key for test environments and a
live-mode key for production; Stripe keeps products, prices, and portal
configurations separate by mode.

If the deployment platform expects one command for the whole sequence, use
`bun run deploy`. It prepares the database and Stripe catalog before building
the app.

The Billing Portal sync finds a configuration with the required features and
updates it, or creates one if none exists. It enables payment method updates,
invoice history, and cancellation at the period end; it disables subscription
updates and pauses. No configuration ID needs to be added to the app
environment. `bun run stripe:portal:configure` can also be run on its own when
the Billing Portal configuration needs to be created or updated.

Authenticated customers with a Stripe customer mapping can open the portal from
`/manage` to update payment information, view invoices, or cancel their
subscription. Portal sessions find a configuration by its required feature
settings and return to `/manage`; ambiguous matches fail explicitly. A
scheduled cancellation remains `active` until the paid period ends, so
entitlement continues during that period; access ends when Stripe reports the
subscription as canceled.

## Stripe webhooks

The env sync creates a Stripe webhook endpoint at
`BASE_URL/api/stripe/webhook` and uploads its signing secret to Vercel.
`STRIPE_WEBHOOK_SECRET` is required by the running application but does not
belong in `.env.preview` or `.env.production`. Each sync replaces all Stripe
webhook endpoints in the selected Stripe mode that point to that exact URL.
The subscribed event list's single source of truth is
[`STRIPE_WEBHOOK_EVENTS`](./lib/billing/stripe/webhook-policy.ts).

For local webhook testing, run `stripe listen --forward-to
localhost:3000/api/stripe/webhook` and pass its printed signing secret to the
local app process as `STRIPE_WEBHOOK_SECRET`; it does not need to be saved in an
env file.

The endpoint verifies each signature against the unmodified request body and
stores each verified event once. Checkout and subscription lifecycle events
retrieve the current subscription from Stripe, then synchronize it only when
its Stripe customer ID maps to a known user. Events are marked processed only
after synchronization succeeds; duplicate deliveries retry pending events and
acknowledge already-processed events. An unmapped Stripe customer is linked
only when its server-side `userId` metadata identifies an existing user and the
unique mapping can be saved; otherwise the event remains pending for retry or
manual reconciliation. Never associate a purchase by email or
browser-provided reference.

## Entitlements

Use `requirePaidAccess` from `lib/entitlement.ts` with a user ID from a validated
session. It permits access when at least one linked subscription is `active` or
`trialing`; a scheduled cancellation does not revoke access until the status
changes. It throws `PaidAccessRequiredError` when the user has no eligible
subscription, and database errors propagate to the caller. Subscription
snapshots are revalidated with Stripe after 24 hours; failures to refresh stale
eligible snapshots fail closed.

Vercel runs `GET /api/cron/sync-subscriptions` daily at 00:00 UTC to reconcile
subscription snapshots at least 23 hours old, including non-active
subscriptions. Configure a `CRON_SECRET` in Vercel's environment settings so
only authenticated cron requests can trigger reconciliation. Each run
fetches pages of 10 records and processes them sequentially until it catches up
or reaches its 20-second work budget. Stripe requests time out after five
seconds, and the route has a 30-second maximum duration. Failed records are
logged; the response reports when work remains for the next daily run.

To trigger subscription reconciliation manually (the cron normally runs daily),
install and link the Vercel CLI, then run the command with the target deployment
URL:

```sh
bun run stripe:subscriptions:reconcile -- production https://auth.outboundendurance.com
bun run stripe:subscriptions:reconcile -- preview https://your-preview.vercel.app --branch staging
```

The script loads `CRON_SECRET` directly from the selected Vercel environment
without writing it locally, then sends it as the endpoint's bearer token. A
preview target can use branch-specific Preview variables with `--branch`.
Production runs update production subscription records.

Consuming apps can verify a session or paid entitlement with `POST /api/access`,
sending the Better Auth session cookie's name and value in the JSON body. For
login-only content, send `"access":"authenticated"`:
`{"access":"authenticated","cookie":{"name":"__Secure-better-auth.session_token","value":"..."}}`.
A valid session receives `200` with
`{"accessType":"authenticated","hasAccess":true}` without checking subscription
status. For paid content, send `"access":"paid"`:
`{"access":"paid","cookie":{"name":"__Secure-better-auth.session_token","value":"..."}}`.
A valid entitled session receives `200` with
`{"accessType":"paid","hasAccess":true}`; a signed-in user without paid access
receives `403` with `{"accessType":"paid","hasAccess":false}`. Both access
modes use this same result shape with their corresponding `accessType`; an
invalid session receives `401` with the requested `accessType` and
`"hasAccess":false`. Omitting `access` defaults to `"paid"` for backwards
compatibility. For HTTP development, the cookie name is
`better-auth.session_token`. Send only this session cookie; do not send a user
ID or cache the response. A missing cookie or invalid request body receives
`400`. If session or entitlement verification fails, the endpoint returns
`503`; consuming apps must treat non-`200` responses or network errors as no
access. All responses are marked `Cache-Control: no-store`.

[`example-middleware.ts`](./example-middleware.ts) shows a Next.js Proxy that
submits this cookie in the POST body, redirects unauthenticated users to
`https://auth.outboundendurance.com/login`, and sends signed-in users without
access to `https://auth.outboundendurance.com/subscribe`. It is intended for
consuming subdomains such as `course.outboundendurance.com`, where the shared
Better Auth session cookie is available. In a Next.js 16 app, copy it to
`proxy.ts`, set `AUTH_SERVICE_URL` to the auth service origin (defaults to
`https://auth.outboundendurance.com`), and change the matcher to cover the
consuming app's protected routes. The environment variable controls the access
request and the `/login` and `/subscribe` redirects. Authorization must also be
enforced in server actions and data-access code, not only in Proxy.
The machine-readable OpenAPI description is served at
[`https://auth.outboundendurance.com/openapi.yaml`](https://auth.outboundendurance.com/openapi.yaml).

## Better Auth Secret

Generate a better auth secret

`openssl rand -base64 32`

## Shared sessions

When `BASE_URL` uses any `outboundendurance.com` host, Better Auth trusts
all HTTPS subdomains and the apex origin. In production, configure it as
`https://auth.outboundendurance.com` to share the session cookie across
subdomains; preview deployments keep host-only cookies. Local development
trusts the configured `BASE_URL` origin and localhost ports. Because
the wildcard trusts every subdomain, use it only when all subdomains are
controlled and protected from takeover or untrusted hosting.

Use `getServerSession` from `lib/session.ts` in server-rendered code to validate
the current request's session. The mounted Better Auth route also handles
`POST /api/auth/sign-out`; it expires the shared cookie so the user is signed
out across the trusted subdomains.