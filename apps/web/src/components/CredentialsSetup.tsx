/**
 * @file apps/web/src/components/CredentialsSetup.tsx
 * Collect provider API keys and persist them server-side (masked on read).
 */

"use client";

import { useEffect, useState } from "react";
import type {
  CredentialsSchemaResponse,
  ProviderCredentials,
} from "@tradingagents/api-types";
import { SECRET_CREDENTIAL_PLACEHOLDER } from "@tradingagents/api-types";
import {
  ApiClientError,
  fetchCredentialsSchema,
  fetchUserCredentials,
  resolveConfig,
  saveUserCredentials,
} from "@/lib/api-client";
import { useUserSession } from "@/context/UserSessionContext";
import styles from "./CredentialsSetup.module.css";

function countAvailableProviders(credentials: ProviderCredentials): number {
  return Object.entries(credentials).filter(([, fields]) => {
    if (!fields) {
      return false;
    }
    return Boolean(fields.apiKey?.trim());
  }).length;
}

function hasStoredSecret(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  return value === SECRET_CREDENTIAL_PLACEHOLDER || /^\*+$/.test(value);
}

export default function CredentialsSetup({
  onSuccess,
  continueLabel = "Continue to analysis setup",
  initialSchema,
}: {
  onSuccess?: () => void;
  continueLabel?: string;
  /** When provided (from SSR), skips the client-side schema fetch. */
  initialSchema?: CredentialsSchemaResponse;
}) {
  const {
    setProviderCredentials,
    setCredentialsReady,
    setResolvedConfig,
    credentialDefinitions,
    setCredentialDefinitions,
    modelCatalogNote,
    setModelCatalogNote,
  } = useUserSession();

  const [localCredentials, setLocalCredentials] = useState<ProviderCredentials>({});
  const [loading, setLoading] = useState(!initialSchema);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSchema) {
      setCredentialDefinitions(initialSchema.providers);
      setModelCatalogNote(initialSchema.modelCatalogNote);
    }

    let cancelled = false;

    async function loadInitialData() {
      try {
        const [schema, storedCredentials] = await Promise.all([
          initialSchema ? Promise.resolve(initialSchema) : fetchCredentialsSchema(),
          fetchUserCredentials(),
        ]);

        if (cancelled) {
          return;
        }

        if (!initialSchema) {
          setCredentialDefinitions(schema.providers);
          setModelCatalogNote(schema.modelCatalogNote);
        }
        setLocalCredentials(storedCredentials);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiClientError
              ? err.message
              : "Failed to load provider credential fields.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInitialData();
    return () => {
      cancelled = true;
    };
  }, [initialSchema, setCredentialDefinitions, setModelCatalogNote]);

  function updateField(providerId: string, fieldName: string, value: string) {
    setLocalCredentials((prev) => ({
      ...prev,
      [providerId]: {
        ...(prev[providerId] ?? {}),
        [fieldName]: value,
      },
    }));
    setError(null);
  }

  async function handleContinue() {
    const availableCount = countAvailableProviders(localCredentials);
    if (availableCount === 0) {
      setError("Enter at least one provider API key.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const savedCredentials = await saveUserCredentials(localCredentials);
      const resolved = await resolveConfig();
      if (resolved.providers.length === 0) {
        setError("No providers are available with the credentials you entered.");
        return;
      }
      setProviderCredentials(savedCredentials);
      setResolvedConfig(resolved);
      setCredentialsReady(true);
      setLocalCredentials(savedCredentials);
      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to resolve available providers.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="muted">Loading provider options…</p>;
  }

  return (
    <div className={styles.setup}>
      <div className={styles.intro}>
        <h2 className={styles.title}>Provider API Keys</h2>
        <p className="muted">
          Enter the API keys you have access to. Only matching providers and
          models will appear in the analysis wizard. Keys are saved on the
          server and never returned to the browser.
        </p>
      </div>

      <div className={styles.grid}>
        {credentialDefinitions.map((provider) => {
          const values = localCredentials[provider.id] ?? {};

          return (
            <section key={provider.id} className={styles.card}>
              <header className={styles.cardHeader}>
                <h3>{provider.label}</h3>
                <span className={styles.badge}>{provider.modelSource}</span>
              </header>

              {provider.apiKeyUrl ? (
                <p className={styles.keyLinkRow}>
                  <a
                    href={provider.apiKeyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.keyLink}
                    aria-label={`Get a ${provider.label} API key (opens in a new tab)`}
                  >
                    Get an API key
                  </a>
                </p>
              ) : null}

              {provider.credentialFields.map((field) => {
                const storedValue = values[field.name] ?? "";
                const inputType = field.secret ? "password" : "text";
                const isStoredSecret = field.secret && hasStoredSecret(storedValue);

                return (
                  <label key={field.name} className={styles.field}>
                    <span>
                      {field.label}
                      {field.required ? " *" : ""}
                    </span>
                    <input
                      type={inputType}
                      value={storedValue}
                      placeholder={
                        isStoredSecret
                          ? "Saved — enter a new value to replace"
                          : (field.placeholder ?? undefined)
                      }
                      autoComplete="off"
                      onChange={(event) =>
                        updateField(provider.id, field.name, event.target.value)
                      }
                    />
                  </label>
                );
              })}
            </section>
          );
        })}
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={submitting}
          onClick={() => void handleContinue()}
        >
          {submitting ? "Checking providers…" : continueLabel}
        </button>
      </div>
    </div>
  );
}
