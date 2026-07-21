/**
 * apps/api/src/lib/billing-scaffold.ts
 *
 * Dev-only free subscription activation when Stripe is not configured.
 * Never enable in production — use BILLING_SCAFFOLD=true locally instead.
 */

export function isBillingScaffoldEnabled(): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  return process.env.BILLING_SCAFFOLD?.trim() === "true";
}
