# MVP authentication and billing plan

## MVP behavior

- **Authentication:** Email OTP handles both sign-in and sign-up. Better Auth sends the code through Resend using a React Email template.
- **Shared sessions:** A secure parent-domain cookie shares the session across `auth.domain.tld`, `domain.tld`, and `member.domain.tld`.
- **Access:** Stripe statuses `active` and `trialing` grant paid access. `past_due` and all other statuses do not.
- **Cancellation:** Cancellation takes effect at period end. Access continues while the subscription remains `active` or `trialing`.
- **No eligible plan:** Show the current plan and an embedded Stripe Payment Element. Existing customers, including those who are `past_due`, can update payment information on the self-hosted `/manage` page.
- **Eligible plan:** Show subscription status, payment method, and recent invoices on `/manage`; allow payment updates with Stripe Elements and cancellation at period end. Invoice history is read from Stripe and is not persisted in the application database.

A user can authenticate without an eligible subscription, but can access only billing, not paid application features.

The Payment Element confirms payment on `/subscribe`; Stripe authentication may redirect back to `/billing/return`. The return page uses the signed-in user's synchronized subscription state; redirect parameters do not establish payment or grant access.

## Working steps

Each estimate covers the **total changed lines**, including tests and configuration. Split a step if its actual diff would exceed 200 lines.

| # | Step | Estimate | Completion criteria |
|---|---|---:|---|
| 1 | Set up Turso and Drizzle | 100-180 | Database connection and migration workflow work. |
| 2 | Configure Better Auth | 100-180 | Drizzle adapter and generated auth schema are configured; `/api/auth/[...all]` is mounted. |
| 3 | Configure shared sessions | 80-150 | Parent-domain cookies, explicit trusted origins, session validation, and sign-out work. |
| 4 | Add OTP delivery | 100-180 | Better Auth's OTP plugin sends a React Email via Resend, with expiry, attempt limits, and error handling. |
| 5 | Build sign-in UI | 120-200 | Users can request and verify a code; first sign-in creates an account; return URLs are allowlisted. |
| 6 | Add OTP rate limiting | 100-180 | Upstash limits requests and verification attempts; failure behavior is tested. |
| 7 | Add billing data | 100-180 | Migrations support user-to-customer mappings, subscription state, and processed webhook events. |
| 8 | Implement entitlement policy | 80-150 | A tested server-side guard permits only `active` and `trialing`; scheduled cancellation preserves access until the status changes. |
| 9 | Set up Stripe customers | 100-180 | Authenticated users get a mapped Stripe customer for Payment Element subscription creation. |
| 10 | Display plans | 100-180 | `/subscribe` shows the current plan and embedded Payment Element to users without an eligible plan. |
| 11 | Add self-hosted subscription management | 150-200 | Existing customers manage payment methods and schedule cancellation at `/manage`; recent invoice history is read directly from Stripe. |
| 12 | Verify Stripe webhooks | 100-180 | `/api/stripe/webhook` verifies raw-body signatures and records events for idempotent processing. |
| 13 | Synchronize subscriptions | 120-200 | Subscription events update state; duplicates, delayed events, ordering, and unlinked purchases are handled. |
| 14 | Handle billing returns | 80-150 | `/billing/return` shows processing or confirmed state without granting access based on the redirect alone. |
| 15 | Expose cross-app access | 100-180 | `/api/access` validates the session and entitlement, returns `no-store` responses, and fails closed on errors. |
| 16 | Integrate each consuming app | 100-200 **per app** | The app checks entitlement server-to-server and enforces it for protected pages, actions, and APIs. |
| 17 | Verify and document | 100-200 | Setup is documented and unit tests cover OTP, shared sessions, trials, past-due recovery, purchasing, cancellation, and webhook failures. |

## Implementation safeguards

- **Past-due recovery and another purchase are both available.** Account for an existing unpaid subscription when a user buys another plan; buying a new one must not silently cancel the old subscription or erase an outstanding balance.
- **Subscription freshness:** Define and test a reconciliation window so missed webhooks cannot leave access enabled indefinitely. Fail closed if state cannot be verified after that window.
- **Shared-cookie trust:** The parent-domain cookie reaches all matching subdomains, so each must be trusted and protected against takeover.
- **Payment association:** Reconcile unlinked purchases safely; do not grant access based solely on an email address or browser-provided reference.

Steps 1-15 and 17 are for this service; step 16 requires changes in each consuming application.
