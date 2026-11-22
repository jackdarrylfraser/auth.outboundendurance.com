# auth.outboundendurance.com

## Authentication setup

Better Auth uses `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`. Set a unique random
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

Authenticate the Vercel CLI and link this repository to the intended Vercel
project, then validate and upload each environment:

```sh
bunx vercel login
bunx vercel link
bun run sync:env:preview -- --check
bun run sync:env:preview
bun run sync:env:prod -- --check
bun run sync:env:prod
```

The uploader parses the selected file and `.env.example` with `dotenv`; it
fails before making changes unless the files have exactly the same variable
names and all values are non-empty. It then removes the selected Vercel
environment's variables and recreates the file's variables as Secrets,
sending values through standard input without printing them. Keep Production
and Preview credentials and databases separate, and use Stripe live keys for
Production and test keys for Preview. Variables shared with another Vercel
environment cause the sync to stop rather than delete that other environment's
configuration.

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

`/account` requires sign-in. Users without an `active` or `trialing`
subscription see the current price and one Subscribe button.
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
`/account` to update payment information, view invoices, or cancel their
subscription. Portal sessions find a configuration by its required feature
settings and return to `/account`; ambiguous matches fail explicitly. A
scheduled cancellation remains `active` until the paid period ends, so
entitlement continues during that period; access ends when Stripe reports the
subscription as canceled.

## Stripe webhooks

Set `STRIPE_WEBHOOK_SECRET` to the signing secret for the Stripe webhook
endpoint, separately from `STRIPE_SECRET_KEY`. Configure a Stripe webhook
endpoint with the URL `https://auth.outboundendurance.com/api/stripe/webhook`
and subscribe it to these events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

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

Consuming apps can request the current user's entitlement with
`POST /api/access`, sending the Better Auth session token in a JSON body as
`{"token":"..."}`. The endpoint validates the token and checks paid entitlement;
do not accept a user ID from the browser or cache the response. A valid
entitled session receives `200` with `{"entitled":true}`, a missing or invalid
session token receives `401`, and a signed-in user without paid access receives
`403` with `{"entitled":false}`. A missing token or invalid request body
receives `400`. If session or entitlement verification fails, the endpoint
returns `503`; consuming apps must treat any non-`200` response or network
error as no access. All responses are marked `Cache-Control: no-store`.

## Better Auth Secret

Generate a better auth secret

`openssl rand -base64 32`

## Shared sessions

When `BETTER_AUTH_URL` uses any `outboundendurance.com` host, Better Auth trusts
all HTTPS subdomains and the apex origin. In production, configure it as
`https://auth.outboundendurance.com` to share the session cookie across
subdomains; preview deployments keep host-only cookies. Local development
trusts the configured `BETTER_AUTH_URL` origin and localhost ports. Because
the wildcard trusts every subdomain, use it only when all subdomains are
controlled and protected from takeover or untrusted hosting.

Use `getServerSession` from `lib/session.ts` in server-rendered code to validate
the current request's session. The mounted Better Auth route also handles
`POST /api/auth/sign-out`; it expires the shared cookie so the user is signed
out across the trusted subdomains.