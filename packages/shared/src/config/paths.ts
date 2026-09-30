/**
 * Modified by U Studio for U Agents (优智体) — derivative work
 * based on Craft Agents (Apache 2.0).
 *
 * Original: https://github.com/lukilabs/craft-agents-oss
 * Modifications: see .planning/01-branding-spec.md and .planning/02-llm-gateway-spec.md
 *
 * Centralized path configuration for U Agents.
 *
// U-API: one config root, with nonempty U Agents override before the legacy override.
 * `CONFIG_DIR` is the one place that decides where the app keeps its state
 * (`~/.u-agents` by default). Every other module joins onto it; never join
 * `homedir()` with `.u-agents` directly (OSS #1062).
 *
 * Supports multi-instance development via the CRAFT_CONFIG_DIR environment
 * variable. When running from a numbered folder (e.g., craft-tui-agent-1), the
 * detect-instance.sh script sets CRAFT_CONFIG_DIR to ~/.u-agents-1, allowing
 * multiple instances to run simultaneously with separate configurations.
 *
 * Default (non-numbered folders): ~/.u-agents/
 * Instance 1 (-1 suffix): ~/.u-agents-1/
 * Instance 2 (-2 suffix): ~/.u-agents-2/
 *
 * Two modules re-derive this from the environment on purpose because they must
 * stay import-free: `interceptor-common.ts` (preloaded into the Pi subprocess)
 * and session-tools-core `handlers/config-validate.ts` (no dependency on shared).
 */

import { homedir } from 'os';
import { join } from 'path';

// U-API: one config root, with nonempty U Agents override before the legacy override.
export const DEFAULT_CONFIG_DIR_NAME = '.u-agents';

/**
 * Resolve the config directory: non-empty U_AGENTS_CONFIG_DIR, then CRAFT_CONFIG_DIR, otherwise
 * `<home>/.u-agents`. Pure; `CONFIG_DIR` is this evaluated once at load.
 */
export function resolveConfigDir(env: NodeJS.ProcessEnv = process.env, home: string = homedir()): string {
  const override = env.U_AGENTS_CONFIG_DIR?.trim() || env.CRAFT_CONFIG_DIR?.trim();
  return override ? override : join(home, DEFAULT_CONFIG_DIR_NAME);
}

export const CONFIG_DIR = resolveConfigDir();
