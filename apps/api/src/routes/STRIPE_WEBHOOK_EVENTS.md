# Stripe webhook events for TradingAgents billing

Colocated with `webhooks.ts` (`POST /webhooks/stripe`). Configure these
**exact** event types on the Stripe Dashboard webhook endpoint that points at
your API (`…/webhooks/stripe`).

Signing secret env: `STRIPE_WEBHOOK_SECRET`.

## Required events

Subscribe to all of the following in the Stripe Dashboard (Workbench →
Webhooks → your endpoint → “Select events”):

| Event | Why we need it |
|-------|----------------|
| `checkout.session.completed` | Activate paid plan after Managed Payments Checkout succeeds (paid / no payment required). |
| `checkout.session.async_payment_succeeded` | Same activation path for delayed payment methods (e.g. bank debit). |
| `checkout.session.async_payment_failed` | Acknowledged so Stripe stops retrying; we do **not** grant access. |
| `customer.subscription.updated` | Sync plan status, billing period dates, and **`cancel_at_period_end`** (scheduled cancel / undo cancel). |
| `customer.subscription.deleted` | Mark local subscription `canceled` when Stripe ends it (period end after cancel, or immediate cancel). |
| `invoice.payment_failed` | Mark local subscription `past_due` so new runs are blocked until payment recovers. |

## Cancel subscription flow

In-app cancel (`POST /billing/subscription/cancel`) sets Stripe
`cancel_at_period_end: true`. That keeps Stripe status `active` or `past_due`
until the current period ends (it does **not** void open invoices). The app:

1. Updates local `cancel_at_period_end` immediately from the API response.
2. Relies on `customer.subscription.updated` as the durable sync signal
   (including status + `cancel_at_period_end`).
3. Relies on `customer.subscription.deleted` to set `status = canceled` when
   the period actually ends (no more renewals).

**Access policy after cancel is scheduled:**

- `active` + within period: users keep starting new analyses until
  `current_period_end`.
- `past_due`: new analyses stay blocked; cancel only stops renewals.
- After period end / `canceled`: users can still open existing runs and shared
  `/run/{sessionId}` links; they cannot create new sessions until they
  subscribe again. Sessions are **not** soft-deleted on cancel.

## Optional / not handled

These are **not** required for current billing behavior. You may omit them:

- `customer.subscription.created` — entitlement is granted from Checkout
  completion, not from this event.
- `invoice.paid` / `invoice.payment_succeeded` — period dates come from
  subscription objects on checkout + `customer.subscription.updated`.
- Customer Portal events — we do not use the Stripe Customer Portal yet.

## Local testing

```bash
stripe listen --forward-to localhost:4000/webhooks/stripe
```

Use the CLI signing secret as `STRIPE_WEBHOOK_SECRET` while listening.
