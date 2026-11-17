# auth.outboundendurance.com

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