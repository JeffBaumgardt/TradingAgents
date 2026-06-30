/**
 * @file apps/web/src/context/UserSessionContext.tsx
 * In-memory user session holding provider API keys for the current browser tab.
 * Keys are mirrored in sessionStorage (tab-scoped) but never sent to the database.
 */

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  ConfigOptions,
  ProviderCredentials,
  ProviderCredentialDefinition,
} from "@tradingagents/api-types";
import { resolveConfig } from "@/lib/api-client";

const STORAGE_KEYS = {
  credentials: "tradingagents:providerCredentials",
  ready: "tradingagents:credentialsReady",
} as const;

interface UserSessionContextValue {
  providerCredentials: ProviderCredentials;
  setProviderCredentials: (credentials: ProviderCredentials) => void;
  credentialsReady: boolean;
  setCredentialsReady: (ready: boolean) => void;
  resolvedConfig: ConfigOptions | null;
  setResolvedConfig: (config: ConfigOptions | null) => void;
  credentialDefinitions: ProviderCredentialDefinition[];
  setCredentialDefinitions: (definitions: ProviderCredentialDefinition[]) => void;
  modelCatalogNote: string;
  setModelCatalogNote: (note: string) => void;
  clearSession: () => void;
  hydrating: boolean;
}

const UserSessionContext = createContext<UserSessionContextValue | null>(null);

function readStoredCredentials(): ProviderCredentials {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEYS.credentials);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as ProviderCredentials;
  } catch {
    return {};
  }
}

function readStoredReady(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.sessionStorage.getItem(STORAGE_KEYS.ready) === "true";
}

export function UserSessionProvider({ children }: { children: ReactNode }) {
  const [providerCredentials, setProviderCredentialsState] = useState<ProviderCredentials>({});
  const [credentialsReady, setCredentialsReadyState] = useState(false);
  const [resolvedConfig, setResolvedConfig] = useState<ConfigOptions | null>(null);
  const [credentialDefinitions, setCredentialDefinitions] = useState<
    ProviderCredentialDefinition[]
  >([]);
  const [modelCatalogNote, setModelCatalogNote] = useState("");
  const [hydrating, setHydrating] = useState(true);

  const setProviderCredentials = useCallback((credentials: ProviderCredentials) => {
    setProviderCredentialsState(credentials);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(STORAGE_KEYS.credentials, JSON.stringify(credentials));
    }
  }, []);

  const setCredentialsReady = useCallback((ready: boolean) => {
    setCredentialsReadyState(ready);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(STORAGE_KEYS.ready, ready ? "true" : "false");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const storedCredentials = readStoredCredentials();
      const storedReady = readStoredReady();

      if (Object.keys(storedCredentials).length > 0) {
        setProviderCredentialsState(storedCredentials);
      }

      if (!storedReady || Object.keys(storedCredentials).length === 0) {
        setHydrating(false);
        return;
      }

      try {
        const resolved = await resolveConfig(storedCredentials);
        if (cancelled) {
          return;
        }
        if (resolved.providers.length > 0) {
          setResolvedConfig(resolved);
          setCredentialsReadyState(true);
        } else {
          setCredentialsReadyState(false);
        }
      } catch {
        if (!cancelled) {
          setCredentialsReadyState(false);
        }
      } finally {
        if (!cancelled) {
          setHydrating(false);
        }
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const clearSession = useCallback(() => {
    setProviderCredentialsState({});
    setCredentialsReadyState(false);
    setResolvedConfig(null);
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(STORAGE_KEYS.credentials);
      window.sessionStorage.removeItem(STORAGE_KEYS.ready);
    }
  }, []);

  const value = useMemo(
    () => ({
      providerCredentials,
      setProviderCredentials,
      credentialsReady,
      setCredentialsReady,
      resolvedConfig,
      setResolvedConfig,
      credentialDefinitions,
      setCredentialDefinitions,
      modelCatalogNote,
      setModelCatalogNote,
      clearSession,
      hydrating,
    }),
    [
      providerCredentials,
      setProviderCredentials,
      credentialsReady,
      setCredentialsReady,
      resolvedConfig,
      credentialDefinitions,
      modelCatalogNote,
      clearSession,
      hydrating,
    ],
  );

  return (
    <UserSessionContext.Provider value={value}>{children}</UserSessionContext.Provider>
  );
}

export function useUserSession(): UserSessionContextValue {
  const context = useContext(UserSessionContext);
  if (!context) {
    throw new Error("useUserSession must be used within UserSessionProvider");
  }
  return context;
}
