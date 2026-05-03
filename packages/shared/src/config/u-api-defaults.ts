import type { LlmConnection } from './llm-connections.ts';

export const U_API_BASE_URL = 'https://token.u-studio.cn/v1';
export const U_API_SLUG = 'u-api-default';
export const U_API_NAME = 'U-API';
export const U_API_CONSOLE_URL = 'https://token.u-studio.cn/console/token';
export const U_API_TOPUP_URL = 'https://token.u-studio.cn/console/topup';
export const U_API_PRICING_URL = 'https://token.u-studio.cn/pricing';

export function buildDefaultConnection(): LlmConnection {
  return {
    slug: U_API_SLUG,
    name: U_API_NAME,
    providerType: 'pi_compat',
    baseUrl: U_API_BASE_URL,
    authType: 'api_key_with_endpoint',
    customEndpoint: {
      api: 'anthropic-messages',
      supportsImages: true,
    },
    models: [],
    modelSelectionMode: 'userDefined3Tier',
    createdAt: Date.now(),
  };
}
