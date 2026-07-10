import type { LlmConnection } from './llm-connections.ts';

export const U_API_BASE_URL = 'https://token.u-studio.cn/v1';
export const U_API_SLUG = 'u-api-default';
export const U_API_NAME = 'U-API';
export const U_API_CONSOLE_URL = 'https://token.u-studio.cn/keys';
export const U_API_TOPUP_URL = 'https://token.u-studio.cn/console/topup';
export const U_API_PRICING_URL = 'https://token.u-studio.cn/pricing';

// U-API: 多连接软锁定 — 识别一个 connection 是否属于 U-API（详见 02-llm-gateway-spec.md §6.2.2）。
// 匹配 'u-api-default'（首装机的 primary slug，保留兼容）或 'u-api' / 'u-api-2' / 'u-api-3'...（resolveSlugForMethod 生成）
export function isUApiSlug(slug: string | undefined | null): boolean {
  if (!slug) return false;
  if (slug === U_API_SLUG) return true;
  return /^u-api(-\d+)?$/.test(slug);
}

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
    modelSelectionMode: 'automaticallySyncedFromProvider',
    createdAt: Date.now(),
  };
}
