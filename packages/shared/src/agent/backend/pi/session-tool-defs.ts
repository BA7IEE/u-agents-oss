/**
 * Pi Session Tool Proxy Definitions
 *
 * Thin wrapper around the canonical tool definitions in @u-agents/session-tools-core.
 * Adds the `mcp__session__` prefix that the Pi SDK expects.
 */

import {
  getToolDefsAsJsonSchema,
  SESSION_TOOL_NAMES,
  type JsonSchemaToolDef,
  type SessionToolFilterOptions,
} from '@u-agents/session-tools-core';
import { FEATURE_FLAGS } from '../../../feature-flags.ts';
import { isDecisionFeatureActive } from '../../../decisions/resolve.ts';
import { getBrowserToolEnabled } from '../../../config/storage.ts';
import type { SessionToolProfileOptions } from '../../session-scoped-tools.ts';

// U-API: Pi registration is filtered by full/mini agent kind before merge registration (16 §10.2).

export type SessionToolProxyDef = JsonSchemaToolDef;

export { SESSION_TOOL_NAMES };

export function getSessionToolProxyDefs(options?: SessionToolProfileOptions | 'full' | 'mini'): SessionToolProxyDef[] {
  const profileOptions = typeof options === 'string' ? { agentKind: options } : options;
  return getToolDefsAsJsonSchema({ prefix: 'mcp__session__', ...getPiSessionToolFilterOptions(profileOptions) });
}

// U-API: registration and host execution share feature and live profile filters.
export function getPiSessionToolFilterOptions(profileOptions?: SessionToolProfileOptions): SessionToolFilterOptions {
  return {
    includeDeveloperFeedback: FEATURE_FLAGS.developerFeedback,
    surface: 'pi',
    // U-API: use the same full/mini, coding and feature filters as Claude.
    includeDecide: isDecisionFeatureActive('decideTool'),
    includeBrowser: getBrowserToolEnabled(),
    ...profileOptions,
  };
}
