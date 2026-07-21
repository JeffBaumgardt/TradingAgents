/**
 * apps/api/src/lib/billing-scaffold.ts
 *
 * Dev-only free subscription activation when Stripe is not configured.
 * Never enable in production — use BILLING_SCAFFOLD=true locally instead.
 */

function isProductionRuntime(): boolean {
  if (process.env.NODE_ENV === "production") {
    return true;
  }
  const vercelEnv = process.env.VERCEL_ENV?.trim();
  if (vercelEnv === "production") {
    return true;
  }
  const railwayEnv = process.env.RAILWAY_ENVIRONMENT?.trim().toLowerCase();
  if (railwayEnv === "production") {
    return true;
  }
  return false;
}

export function isBillingScaffoldEnabled(): boolean {
  if (isProductionRuntime()) {
    return false;
  }
  return process.env.BILLING_SCAFFOLD?.trim() === "true";
}
