/**
 * @file apps/web/src/lib/provider-api-key-link.ts
 * Helpers for rendering provider API key signup links on the credentials screen.
 */

export const PROVIDER_API_KEY_URLS = {
  openai: "https://platform.openai.com/api-keys",
  google: "https://aistudio.google.com/apikey",
  anthropic: "https://console.anthropic.com/settings/keys",
  xai: "https://console.x.ai/team/default/api-keys",
  deepseek: "https://platform.deepseek.com/api_keys",
  qwen: "https://dashscope.console.aliyun.com/apiKey",
  glm: "https://open.bigmodel.cn/usercenter/apikeys",
  openrouter: "https://openrouter.ai/keys",
  azure: "https://portal.azure.com/#create/Microsoft.CognitiveServicesOpenAI",
} as const;

export type ProviderApiKeyUrlId = keyof typeof PROVIDER_API_KEY_URLS;

export function resolveProviderApiKeyUrl(
  apiKeyUrl: string | null | undefined,
): string | null {
  if (!apiKeyUrl?.startsWith("https://")) {
    return null;
  }

  return apiKeyUrl;
}

export function resolveProviderApiKeyLink(
  providerId: string,
  apiKeyUrl: string | null | undefined,
): string | null {
  const resolvedFromSchema = resolveProviderApiKeyUrl(apiKeyUrl);
  if (resolvedFromSchema) {
    return resolvedFromSchema;
  }

  if (providerId in PROVIDER_API_KEY_URLS) {
    return PROVIDER_API_KEY_URLS[providerId as ProviderApiKeyUrlId];
  }

  return null;
}

export function getProviderApiKeyLinkLabel(providerId: string): string {
  if (providerId === "azure") {
    return "Set up in Azure portal";
  }

  return "Get an API key";
}

export function getProviderApiKeyLinkHint(providerId: string): string | null {
  if (providerId === "azure") {
    return "Create a resource, then copy the key, endpoint, and deployment name below.";
  }

  return null;
}
