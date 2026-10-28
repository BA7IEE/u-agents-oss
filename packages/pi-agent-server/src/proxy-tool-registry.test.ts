// U-API: scoped registration regression tests.
import { expect, test } from 'bun:test';
import { ProxyToolRegistry } from './proxy-tool-registry.ts';
const tool = (name: string, description = name) => ({ name, description, inputSchema: { type: 'object' } });

test('scope replacement supports revocation, deduplication, reserved names and stable no-op updates', () => {
  const r = new ProxyToolRegistry();
  r.register([tool('mcp__session__pr_status')], 'session');
  r.register([tool('mcp__source__read'), tool('mcp__session__decide')], 'sources');
  expect(r.definitions().map(t => t.name)).toEqual(['mcp__session__pr_status', 'mcp__source__read']);
  expect(r.register([tool('mcp__session__pr_status')], 'session')).toBe(false);
  r.register([], 'session');
  expect(r.definitions().map(t => t.name)).toEqual(['mcp__source__read']);
  r.register([tool('mcp__session__pr_status')], 'session');
  r.register([], 'sources');
  expect(r.definitions().map(t => t.name)).toEqual(['mcp__session__pr_status']);
});

test('unscoped old hosts retain merge/replace behavior, then scopes take ownership', () => {
  const r = new ProxyToolRegistry();
  r.register([tool('mcp__session__old'), tool('mcp__source__old')]);
  r.register([tool('mcp__source__new'), tool('mcp__session__old', 'updated')]);
  expect(r.definitions()).toHaveLength(3);
  expect(r.definitions().find(t => t.name === 'mcp__session__old')?.description).toBe('updated');
  r.register([], 'session');
  expect(r.definitions().map(t => t.name)).toEqual(['mcp__source__new', 'mcp__source__old']);
  r.register([], 'sources');
  expect(r.definitions()).toEqual([]);
});
