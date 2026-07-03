/**
 * @file apps/api/src/lib/startup-diagnostics.ts
 * Safe startup logging for Railway/deploy debugging (never prints secret values).
 */

function envStatus(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    return "MISSING";
  }
  return `set (len=${value.length})`;
}

function keyHint(name: string): string | null {
  const value = process.env[name]?.trim();
  if (!value) {
    return null;
  }

  if (value.startsWith("sb_secret_")) {
    return "format=sb_secret_* (new Supabase secret key)";
  }
  if (value.startsWith("sb_publishable_")) {
    return "format=sb_publishable_* (new Supabase publishable key)";
  }
  if (value.startsWith("eyJ")) {
    return "format=JWT (legacy anon/service_role — prefer sb_secret_* / sb_publishable_* from Connect dialog)";
  }
  return "format=unknown prefix";
}

function tryHost(url: string | undefined): string | null {
  if (!url) {
    return null;
  }
  try {
    return new URL(url).host;
  } catch {
    return "INVALID_URL";
  }
}

/** Log env presence and Supabase hints at process start. */
export function logStartupDiagnostics(): void {
  console.log("[startup] TradingAgents API boot diagnostics");

  for (const name of [
    "PORT",
    "NODE_ENV",
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_JWKS_URL",
    "CLERK_SECRET_KEY",
    "AGENTS_SERVICE_URL",
    "CORS_ORIGIN",
  ]) {
    console.log(`[startup] ${name}: ${envStatus(name)}`);
  }

  const publishableHint = keyHint("SUPABASE_PUBLISHABLE_KEY");
  const secretHint = keyHint("SUPABASE_SECRET_KEY");

  if (publishableHint) {
    console.log(`[startup] publishable key ${publishableHint}`);
  }
  if (secretHint) {
    console.log(`[startup] secret key ${secretHint}`);
  }

  const supabaseHost = tryHost(process.env.SUPABASE_URL);
  const jwksHost = tryHost(process.env.SUPABASE_JWKS_URL);
  if (supabaseHost && jwksHost) {
    console.log(
      `[startup] JWKS host ${jwksHost} ${jwksHost === supabaseHost ? "matches" : "DIFFERS from"} SUPABASE_URL host ${supabaseHost}`,
    );
  }

  const hasSecret = Boolean(process.env.SUPABASE_SECRET_KEY?.trim());
  const hasPublishable = Boolean(process.env.SUPABASE_PUBLISHABLE_KEY?.trim());

  if (!process.env.SUPABASE_URL?.trim()) {
    console.error("[startup] SUPABASE_URL is required");
  }
  if (!hasSecret) {
    console.error(
      "[startup] SUPABASE_SECRET_KEY is required for supabaseAdmin (use sb_secret_* from Supabase Connect, not publishable/anon)",
    );
  }
  if (!hasPublishable) {
    console.warn(
      "[startup] SUPABASE_PUBLISHABLE_KEY missing (needed for some auth modes)",
    );
  }
  if (!process.env.SUPABASE_JWKS_URL?.trim()) {
    console.warn(
      "[startup] No JWKS configured (SUPABASE_JWKS_URL or SUPABASE_JWKS)",
    );
  }
}
