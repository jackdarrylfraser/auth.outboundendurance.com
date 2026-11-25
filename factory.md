# Factory and service refactor plan

## Goal

Introduce a server-side infrastructure factory for shared dependencies and domain services for localized business workflows. Keep HTTP handling, domain policy, and infrastructure concerns distinct while preserving current behavior.

## Target boundaries

```text
app/api/*/route.ts                 HTTP parsing and response formatting
lib/infrastructure/                Shared server adapters and composition
lib/access/                        Access workflows and entitlement policies
lib/billing/                       Billing services, Stripe policies and workflows
lib/auth/                          Auth configuration and session workflows
```

- The infrastructure factory constructs shared dependencies such as the database, Stripe, Resend, and logger, then exposes them through a typed object.
- Domain service factories accept only the dependencies needed for their workflows. Avoid making a service depend on the entire infrastructure object when a smaller interface will do.
- Keep pure policies and value transformations independent of infrastructure.
- Keep routes responsible for HTTP-specific concerns: request parsing, authentication boundaries, status codes, and response formatting.
- Keep Better Auth configuration in `lib/auth/server.ts`. Add an auth service only where it clarifies a real workflow.
- Do not add a general-purpose dependency-injection container or move business logic into the infrastructure factory.
- Keep server infrastructure out of client components and client-side auth code.

## Implementation steps

### 1. Establish types and boundaries

- Define the infrastructure and service dependency types.
- Keep validated environment configuration separate from services.
- Decide which dependencies are shared globally and which belong to an individual workflow.

### 2. Add the infrastructure factory

- Add a small `createInfrastructure()` factory and a shared server-side instance.
- Consolidate dependency setup currently spread across `lib/db/index.ts`, `lib/billing/stripe/client.ts`, `lib/email/resend.ts`, and `lib/logger.ts` gradually.
- Allow tests to supply fakes without creating clients or making network calls.
- Preserve appropriate singleton behavior; do not instantiate global clients once per request.

### 3. Add domain services around workflows

- Start with billing workflows that coordinate multiple operations: checkout creation, portal sessions, subscription synchronization, and webhook processing.
- Move orchestration and persistence/provider coordination out of infrastructure clients and into domain services.
- Keep entitlement rules in policy modules; have an access service coordinate data access and any required Stripe freshness checks.
- Reuse existing policy and handler factories instead of duplicating their logic.

### 4. Thin route handlers

- Move business orchestration from routes such as `app/api/billing/checkout-session/route.ts` and `app/api/stripe/webhook/route.ts` into services.
- Keep HTTP validation, response construction, and status-code decisions at the route boundary.
- Keep Stripe webhook signature verification tied to the raw request body at the HTTP boundary; pass the verified event to the webhook service for processing.
- Compose each route's service once at the module boundary.

### 5. Migrate incrementally

- Use the access endpoint as the first low-risk slice. Preserve `lib/access/handler.ts` and its dependency-injected behavior, then wire dependencies through the new composition.
- Migrate billing workflows one at a time, keeping route contracts and error behavior stable.
- Update cron routes and scripts to use the same services so operational and app entry points share business behavior.
- Avoid unrelated refactors while migrating each slice.

### 6. Verify each slice

- Unit-test services with fake dependencies; retain existing tests for policies and HTTP handlers.
- Cover entitlement decisions, Stripe customer idempotency and mapping, webhook duplicate handling and event ordering, and subscription freshness.
- For each slice, run focused Bun tests and lint. After migration, run the full test suite and production build.
- Confirm that client bundles do not import server infrastructure.

## First milestone

Add the infrastructure factory and migrate the access endpoint without changing its external request or response behavior. This validates the composition approach before applying it to the more involved billing workflows.
