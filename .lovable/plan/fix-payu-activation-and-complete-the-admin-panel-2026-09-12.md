# Fix PayU activation and complete the admin panel

## Outcome
- A verified ₹100 PayU payment activates Pro immediately and safely on repeat callbacks.
- The admin account `theyashpawar92@gmail.com` can view customers, payments, subscriptions, and webhook logs.
- Admin data refreshes live when payment, subscription, customer, or webhook records change.

## Implementation
1. Harden both PayU return and webhook handlers: validate the signed response, verify order/provider/amount, apply the paid order, and record actionable webhook results.
2. Improve checkout return handling so paid, pending, failed, and callback-error states are visible and subscription data refreshes immediately.
3. Move admin reads behind an authenticated server function with a database role check before privileged access.
4. Rebuild the admin dashboard around customers, payments, subscriptions, and webhook logs with status summaries and live refresh subscriptions.
5. Ensure the requested email owns the admin role without changing customer data or existing plans.
6. Add required route metadata and verify signed-out access denial, app rendering, PayU endpoints, and focused tests/type checks.

## Technical details
- Keep PayU key and salt server-side only.
- Keep `apply_paid_order` as the single idempotent subscription fulfilment path.
- Use `user_roles` and `has_role()` for authorization; never trust a client-side admin flag.
- Preserve existing tables and records; any database change will be additive or a targeted role assignment.
