/* U-API START: 12 §2.1 — copy pi-agent-server + session-mcp-server into electron resources
   AND download the bundled bun runtime before packaging.

   Why (pi-agent-server): upstream's `electron:build` chain never invokes copyPiAgentServer /
   buildMcpServers, so apps/electron/resources/pi-agent-server/ stays empty and the packaged
   DMG ships with no pi-agent-server bundle. First LLM message throws `piServerPath not
   configured` (M1 v0.9.0 first blocker — fix shipped in 8ebe8c0).

   Why (vendor/bun): the same `electron:build` chain never invokes downloadBun(), so
   apps/electron/vendor/bun/bun is missing. runtime-resolver.ts:64-83 then can't find the
   bundled runtime, falls through to process.execPath, and pi-agent.ts spawns a fresh
   instance of the U Agents Electron binary as the "node" runtime — Dock briefly shows a
   second U Agents icon that vanishes when the child Electron process throws on the ESM
   bundle (M1 v0.9.0 second blocker, surfaced after the pi-agent-server copy fix).

   Cross-arch caveat: downloadBun() writes to a single `apps/electron/vendor/bun/bun` path,
   not arch-namespaced. We currently download only the host arch; the off-host-arch DMG
   (e.g. U-Agents-x64.dmg from an arm64 build host) ships an incompatible bun binary and
   will exhibit the same Dock-flash bug. M2 must split the build into per-arch passes that
   download the right bun before each electron-builder invocation. */
import { existsSync, cpSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { Platform, Arch, BuildConfig } from './build/common';
import { copyPiAgentServer, downloadBun } from './build/common';

const ROOT_DIR = join(import.meta.dir, '..');
const ELECTRON_DIR = join(ROOT_DIR, 'apps/electron');

const rawPlatform = process.platform;
const rawArch = process.arch;
if (rawPlatform !== 'darwin' && rawPlatform !== 'win32' && rawPlatform !== 'linux') {
  throw new Error(`Unsupported host platform for copy-subprocess-servers: ${rawPlatform}`);
}
if (rawArch !== 'x64' && rawArch !== 'arm64') {
  throw new Error(`Unsupported host arch for copy-subprocess-servers: ${rawArch}`);
}
const platform: Platform = rawPlatform;
const arch: Arch = rawArch;

const buildConfig: BuildConfig = {
  rootDir: ROOT_DIR,
  electronDir: ELECTRON_DIR,
  platform,
  arch,
  upload: false,
  uploadLatest: false,
  uploadScript: false,
};

async function main(): Promise<void> {
  // 1. Pi agent server (+ koffi minimal subset for current arch)
  copyPiAgentServer(buildConfig);

  const piIndex = join(ELECTRON_DIR, 'resources/pi-agent-server/index.js');
  if (!existsSync(piIndex)) {
    throw new Error(
      `pi-agent-server build output missing at ${piIndex} after copy. ` +
      `Did \`server:build:subprocess\` run before this step?`,
    );
  }

  // 2. Session MCP server (single-file bundle)
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

  // 3. Bundled bun runtime — required by pi-agent.ts spawn (host arch only; see header).
  const bunBinary = platform === 'win32' ? 'bun.exe' : 'bun';
  const bunPath = join(ELECTRON_DIR, 'vendor/bun', bunBinary);
  if (existsSync(bunPath)) {
    console.log(`✓ Bundled bun runtime cached at ${bunPath} (skipping download)`);
  } else {
    await downloadBun(buildConfig);
    if (!existsSync(bunPath)) {
      throw new Error(`downloadBun() did not produce ${bunPath}`);
    }
  }

  // 4. Re-sync dist/resources so electron-build-resources output is consistent.
  const distResources = join(ELECTRON_DIR, 'dist/resources');
  if (existsSync(distResources)) {
    cpSync(join(ELECTRON_DIR, 'resources'), distResources, { recursive: true, force: true });
    console.log('✓ Re-synced apps/electron/dist/resources/ with subprocess servers');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
/* U-API END */
