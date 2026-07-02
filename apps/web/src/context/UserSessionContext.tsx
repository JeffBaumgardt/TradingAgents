/**
 * @file apps/web/src/context/UserSessionContext.tsx
 * Client session state for resolved provider config. API keys live server-side only.
 */

"use client";

import { useAuth } from "@clerk/nextjs";
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
import { fetchUserCredentials, resolveConfig } from "@/lib/api-client";

const STORAGE_KEYS = {
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

export function UserSessionProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
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
  }, []);

  const setCredentialsReady = useCallback((ready: boolean) => {
    setCredentialsReadyState(ready);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(STORAGE_KEYS.ready, ready ? "true" : "false");
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn || !userId) {
      setHydrating(false);
      return;
    }

    let cancelled = false;
    setHydrating(true);

    async function hydrate() {
      try {
        const [storedCredentials, resolved] = await Promise.all([
          fetchUserCredentials(),
          Promise.race([
            resolveConfig(),
            new Promise<never>((_, reject) => {
              window.setTimeout(() => reject(new Error("Config resolve timed out")), 8000);
            }),
          ]),
        ]);

        if (cancelled) {
          return;
        }

        setProviderCredentialsState(storedCredentials);
        const ready = resolved.providers.length > 0;
        setCredentialsReadyState(ready);
        if (ready) {
          setResolvedConfig(resolved);
        } else {
          setResolvedConfig(null);
        }
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(STORAGE_KEYS.ready, ready ? "true" : "false");
        }
      } catch {
        if (!cancelled) {
          setCredentialsReadyState(false);
          setResolvedConfig(null);
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem(STORAGE_KEYS.ready, "false");
          }
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
  }, [isLoaded, isSignedIn, userId]);

  const clearSession = useCallback(() => {
    setProviderCredentialsState({});
    setCredentialsReadyState(false);
    setResolvedConfig(null);
    if (typeof window !== "undefined") {
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
