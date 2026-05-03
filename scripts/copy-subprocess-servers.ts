/* U-API START: 12 §2.1 — copy pi-agent-server + session-mcp-server into electron resources before packaging.
   Why: upstream's `electron:build` chain never invokes copyPiAgentServer / buildMcpServers,
   so apps/electron/resources/pi-agent-server/ stays empty and the packaged DMG ships with no
   pi-agent-server bundle. Result: first LLM message throws `piServerPath not configured`
   (M1 v0.9.0 actual blocker). This script bridges that gap; package.json wires it as
   `electron:build:subprocess` at the tail of `electron:build`. */
import { existsSync, cpSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { Platform, Arch } from './build/common';
import { copyPiAgentServer } from './build/common';

const ROOT_DIR = join(import.meta.dir, '..');
const ELECTRON_DIR = join(ROOT_DIR, 'apps/electron');

const platform = process.platform;
const arch = process.arch;
if (platform !== 'darwin' && platform !== 'win32' && platform !== 'linux') {
  throw new Error(`Unsupported host platform for copy-subprocess-servers: ${platform}`);
}
if (arch !== 'x64' && arch !== 'arm64') {
  throw new Error(`Unsupported host arch for copy-subprocess-servers: ${arch}`);
}

copyPiAgentServer({
  rootDir: ROOT_DIR,
  electronDir: ELECTRON_DIR,
  platform: platform as Platform,
  arch: arch as Arch,
  upload: false,
  uploadLatest: false,
  uploadScript: false,
});

const piIndex = join(ELECTRON_DIR, 'resources/pi-agent-server/index.js');
if (!existsSync(piIndex)) {
  throw new Error(
    `pi-agent-server build output missing at ${piIndex} after copy. ` +
    `Did \`server:build:subprocess\` run before this step?`,
  );
}

const sessionSrc = join(ROOT_DIR, 'packages/session-mcp-server/dist/index.js');
const sessionDestDir = join(ELECTRON_DIR, 'resources/session-mcp-server');
const sessionDest = join(sessionDestDir, 'index.js');
if (!existsSync(sessionSrc)) {
  throw new Error(
    `session-mcp-server build output missing at ${sessionSrc}. ` +
    `Did \`server:build:subprocess\` run before this step?`,
  );
}
mkdirSync(sessionDestDir, { recursive: true });
cpSync(sessionSrc, sessionDest);
console.log('✓ Copied session-mcp-server → apps/electron/resources/');

const distResources = join(ELECTRON_DIR, 'dist/resources');
if (existsSync(distResources)) {
  cpSync(join(ELECTRON_DIR, 'resources'), distResources, { recursive: true, force: true });
  console.log('✓ Re-synced apps/electron/dist/resources/ with subprocess servers');
}
/* U-API END */
