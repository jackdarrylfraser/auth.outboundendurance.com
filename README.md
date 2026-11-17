# auth.outboundendurance.com

## Authentication setup

Better Auth uses `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`. Set a unique random
secret of at least 32 characters and the public base URL of this service in an
ignored environment file or the deployment platform's secret settings. The
local URL is `http://localhost:3000`.

## Database setup

The database uses Turso/libSQL with Drizzle ORM. For local development, copy
`.env.example` to `.env.local`; the default URL uses a local `local.db` file and
does not need an auth token.

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