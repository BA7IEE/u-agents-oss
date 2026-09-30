// U-API: fixed product boundaries; no environment variable can enable a second model outlet or publishing.
export const U_AGENTS_FEATURE_POLICY = Object.freeze({
  decisionLayerAllowed: false,
  pagesPublishingAllowed: false,
  pagesScriptsAllowed: false,
  pagesRefreshAllowed: false,
});
export const DECISION_DISABLED_REASON = 'U Agents 不支持独立决策模型';
export const PAGES_SCRIPT_DISABLED_REASON = '当前版本不支持 Pages 脚本动作或定时刷新';
