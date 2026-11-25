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

Build and verify services in dependency order. Keep service factories free of HTTP concerns, inject only the persistence/provider operations each workflow needs, and leave the existing route contracts unchanged until step 4.

1. **Stripe customer service**
   - Move customer lookup and idempotent customer creation/mapping out of `lib/billing/stripe/client.ts`.
   - Keep customer-to-user verification rules in `customer-link.ts`; inject the database and Stripe customer operations.
   - Reuse this service from checkout and portal workflows rather than duplicating mapping logic.
2. **Subscription synchronization service**
   - Move subscription retrieval coordination, customer mapping verification, and persistence from `subscriptions.ts` into an injectable service.
   - Keep subscription value conversion and event-ordering rules pure and independently testable.
   - Support both webhook event timestamps and freshness checks that guard against overwriting newer webhook state.
3. **Checkout and billing portal services**
   - Add separate services for checkout creation and portal-session creation.
   - Checkout coordinates the current catalog plan, customer service, Stripe Checkout, and existing return-URL policies.
   - Portal coordinates the customer mapping, configuration selection policy, and Stripe Billing Portal session.
4. **Webhook processing service**
   - Move event persistence, duplicate detection, subscription retrieval/synchronization, and processed-state updates into a service.
   - Accept an already verified event; raw-body signature verification remains an HTTP-boundary responsibility for step 4.
5. **Access service**
   - Keep entitlement decisions in `entitlement-policy.ts`.
   - Add a service that loads a user's subscriptions, refreshes stale eligible subscriptions through the synchronization service, then applies the existing paid-access guard.
   - Keep the current access handler's injected behavior; route composition is handled in step 4.

Add focused fake-dependency tests for each service, including customer idempotency/mapping, subscription event ordering and freshness, webhook duplicate handling, and access refresh behavior. Reuse existing policies and handler factories rather than duplicating their logic.

### 4. Thin route handlers

Migrate each route in the same order: compose its service, leave HTTP-specific work at the boundary, delegate the workflow, and verify that the route contract is unchanged.

1. **Compose dependencies once**
   - Build each route's service from the shared server infrastructure at the module boundary, not during each request.
   - Pass only the dependencies the service needs; do not pass the full infrastructure object by default.
2. **Keep the HTTP boundary explicit**
   - Leave request parsing and validation, authentication boundaries, response construction, and status-code decisions in the route.
   - Keep business orchestration in the service, with no `Request`, `Response`, or HTTP status handling in service code.
3. **Migrate routes by workflow**
   - Start with the access endpoint, then migrate checkout and billing portal routes, and then the Stripe webhook route.
   - For each route, replace orchestration with a service call while preserving its existing request and response contract and error behavior.
4. **Preserve webhook verification**
   - Read the raw request body and verify the Stripe signature in the webhook route.
   - Pass only the verified event to the webhook processing service; do not move signature verification into that service.
5. **Verify each migrated route**
   - Add or retain focused tests for route-level validation, authentication, responses, and status codes, alongside the service tests from step 3.
   - Confirm each route composes its service once and that client-side code cannot import server infrastructure.

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
