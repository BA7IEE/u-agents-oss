// U-API: scoped replacements revoke stale tools while preserving the other tool group.
export interface ProxyToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export type ProxyToolScope = 'session' | 'sources';

export class ProxyToolRegistry {
  private session = new Map<string, ProxyToolDef>();
  private sources = new Map<string, ProxyToolDef>();
  private legacy = new Map<string, ProxyToolDef>();

  register(tools: ProxyToolDef[], scope?: ProxyToolScope): boolean {
    const before = JSON.stringify(this.definitions());
    if (scope) {
      const next = new Map(tools.map(tool => [tool.name, tool]));
      if (scope === 'session') this.session = next;
      else this.sources = next;
      // A scoped update takes ownership from legacy merge registrations too.
      for (const name of this.legacy.keys()) {
        if (name.startsWith('mcp__session__') === (scope === 'session')) this.legacy.delete(name);
      }
    } else {
      for (const tool of tools) {
        const owner = this.session.has(tool.name) ? this.session
          : this.sources.has(tool.name) ? this.sources : this.legacy;
        owner.set(tool.name, tool);
      }
    }
    return before !== JSON.stringify(this.definitions());
  }

  definitions(): ProxyToolDef[] {
    // Session namespace is reserved even when a particular session tool is currently disabled.
    const sourceTools = [...this.sources.values()].filter(tool => !tool.name.startsWith('mcp__session__'));
    const all = new Map([...this.legacy.values(), ...sourceTools, ...this.session.values()].map(tool => [tool.name, tool]));
    return [...all.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
}
