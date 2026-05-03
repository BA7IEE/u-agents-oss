/**
 * Modified by U Studio for U Agents (优智体) — derivative work
 * based on Craft Agents (Apache 2.0).
 *
 * Original: https://github.com/lukilabs/craft-agents-oss
 * Modifications: see .planning/01-branding-spec.md
 *
 * Centralized branding assets for U Agents
 * Used by OAuth callback pages
 */

export const CRAFT_LOGO = [
  '  ████████ █████████    ██████   ██████████ ██████████',
  '██████████ ██████████ ██████████ █████████  ██████████',
  '██████     ██████████ ██████████ ████████   ██████████',
  '██████████ ████████   ██████████ ███████      ██████  ',
  '  ████████ ████  ████ ████  ████ █████        ██████  ',
] as const;

/** Logo as a single string for HTML templates */
export const CRAFT_LOGO_HTML = CRAFT_LOGO.map((line) => line.trimEnd()).join('\n');

/** Session viewer base URL */
export const VIEWER_URL = 'https://u-agents.u-studio.cn';
