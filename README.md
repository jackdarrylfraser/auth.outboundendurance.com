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

## Stripe customer sessions

Set `STRIPE_SECRET_KEY` in `.env.local` or the deployment platform's secret
settings. `POST /api/billing/customer-session` requires a valid Better Auth
session. It creates or reuses the authenticated user's Stripe customer mapping
and returns a short-lived pricing-table Customer Session client secret. The
response is not cacheable; never log or persist the client secret.

Create a pricing table in the Stripe Dashboard, then set
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and
`NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID` to values from the same Stripe account and
mode. `/account` requires sign-in; users without an `active` or `trialing`
subscription can choose a plan and complete Stripe-hosted Checkout there.

## Entitlements

Use `requirePaidAccess` from `lib/entitlement.ts` with a user ID from a validated
session. It permits access when at least one linked subscription is `active` or
`trialing`; a scheduled cancellation does not revoke access until the status
changes. It throws `PaidAccessRequiredError` when the user has no eligible
subscription, and database errors propagate to the caller.

## Better Auth Secret

Generate a better auth secret

`openssl rand -base64 32`

## Shared sessions

In production, Better Auth shares its session cookie across subdomains of
`outboundendurance.com` and trusts those subdomains plus the apex origin.
Configure `BETTER_AUTH_URL` as
`https://auth.outboundendurance.com` to enable the parent-domain cookie. Local
development keeps a host-only cookie and trusts only the configured
`BETTER_AUTH_URL` origin. Because the wildcard trusts every subdomain, use it
only when all subdomains are controlled and protected from takeover or
untrusted hosting.

Use `getServerSession` from `lib/session.ts` in server-rendered code to validate
the current request's session. The mounted Better Auth route also handles
`POST /api/auth/sign-out`; it expires the shared cookie so the user is signed
out across the trusted subdomains.