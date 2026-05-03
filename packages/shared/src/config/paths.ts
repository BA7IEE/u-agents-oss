/**
 * Modified by U Studio for U Agents (优智体) — derivative work
 * based on Craft Agents (Apache 2.0).
 *
 * Original: https://github.com/lukilabs/craft-agents-oss
 * Modifications: see .planning/01-branding-spec.md and .planning/02-llm-gateway-spec.md
 *
 * Centralized path configuration for U Agents.
 *
 * Supports multi-instance development via U_AGENTS_CONFIG_DIR environment variable.
 * When running from a numbered folder, the detect-instance.sh script sets
 * U_AGENTS_CONFIG_DIR to ~/.u-agents-1, allowing multiple instances to run
 * simultaneously with separate configurations.
 *
 * Default (non-numbered folders): ~/.u-agents/
 * Instance 1 (-1 suffix): ~/.u-agents-1/
 * Instance 2 (-2 suffix): ~/.u-agents-2/
 */

import { homedir } from 'os';
import { join } from 'path';

// U-API: allow the new env var while preserving the legacy override for dev workflows.
// Falls back to default ~/.u-agents/ for production and non-numbered dev folders
export const CONFIG_DIR = process.env.U_AGENTS_CONFIG_DIR || process.env.CRAFT_CONFIG_DIR || join(homedir(), '.u-agents');
