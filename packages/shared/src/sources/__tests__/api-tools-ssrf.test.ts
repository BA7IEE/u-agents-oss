/**
 * api-tools SSRF guard 防回归测试（v23 P1 follow-up）
 *
 * 在 packages/shared/src/sources/api-tools.ts 的 createApiTool fetch 调用前，
 * 必须有 assertPublicHttpsUrl 守护——防止恶意 source 配 baseUrl 诱导 AI
 * 带 Authorization 头打云元数据 / 内网。
 *
 * 详见：
 *   - .planning/M3-REFRESH-API-SSRF-SPEC.md §5.2 follow-up（v23 落地）
 *   - .planning/sync-reports/REVIEW-23-DEEP-MULTI-AGENT-2026-05-07.md §2.2
 *
 * §3.7 关联：#45 api-tools.ts SSRF marker（基线 71 → 73）
 */

import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');

function readSource(relPath: string): string {
  return readFileSync(join(REPO_ROOT, relPath), 'utf-8');
}

describe('api-tools SSRF guard（防回归）', () => {
  const apiToolsSrc = readSource('packages/shared/src/sources/api-tools.ts');

  it('imports assertPublicHttpsUrl from utils/url-safety', () => {
    expect(apiToolsSrc).toMatch(/import\s*\{\s*assertPublicHttpsUrl\s*\}\s*from\s*['"]\.\.\/utils\/url-safety\.ts['"]/);
  });

  it('SSRF guard 在 fetch 调用前（safety check 必在 await fetch 之上）', () => {
    const lines = apiToolsSrc.split('\n');
    const safetyLineIdx = lines.findIndex(l => /const\s+safety\s*=\s*assertPublicHttpsUrl\(url\)/.test(l));
    const fetchLineIdx = lines.findIndex(l => /const\s+response\s*=\s*await\s+fetch\(url/.test(l));

    expect(safetyLineIdx).toBeGreaterThan(-1);
    expect(fetchLineIdx).toBeGreaterThan(-1);
    expect(safetyLineIdx).toBeLessThan(fetchLineIdx);
  });

  it('SSRF rejection 返回 isError: true 错误响应（不抛异常吞会话）', () => {
    // 检查 safety.ok 失败分支返回 MCP tool 错误响应格式（与 L281-291 既有 error 格式一致）
    expect(apiToolsSrc).toMatch(/if\s*\(\s*!\s*safety\.ok\s*\)\s*\{[\s\S]+?isError:\s*true/);
    expect(apiToolsSrc).toMatch(/Request blocked by SSRF guard/);
  });

  it('U-API marker 2 处（import + 接入点）', () => {
    const matches = apiToolsSrc.match(/\/\/\s*U-API:\s*M3 SSRF/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});
