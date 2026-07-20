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
} from '@u-agents/session-tools-core';
import { FEATURE_FLAGS } from '../../../feature-flags.ts';

// U-API: Pi registration is filtered by full/mini agent kind before merge registration (16 §10.2).

export type SessionToolProxyDef = JsonSchemaToolDef;

export { SESSION_TOOL_NAMES };

export function getSessionToolProxyDefs(agentKind: 'full' | 'mini' = 'full'): SessionToolProxyDef[] {
  return getToolDefsAsJsonSchema({
    prefix: 'mcp__session__',
    includeDeveloperFeedback: FEATURE_FLAGS.developerFeedback,
    surface: 'pi',
    agentKind,
  });
}
