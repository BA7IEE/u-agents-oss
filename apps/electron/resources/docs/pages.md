# Pages

Pages are persistent, self-hosted HTML mini apps stored in the workspace and rendered inside the app (sidebar → **Pages**). Use them for dashboards, reports, trackers, and small tools that should outlive the conversation. U Agents supports local Pages and explicitly approved API/MCP source actions. Host script actions, scheduled refresh, and public publishing are disabled.

## Folder layout (managed — do not edit directly)

```
{workspace}/pages/{slug}/
├── page.json          # config/manifest (watcher trigger — always written LAST)
├── index.html         # the page content (sha256 digest tracked in page.json)
└── data/
    ├── store.sqlite   # internal store (scripts only — never read this)
    └── snapshot.json  # the ONLY data artifact pages/hosts read
```

Always use the session tools (`create_page`, `update_page`, `write_page_data`, `delete_page`) instead of file tools. They keep content digests, grants, the config watcher, and open renders consistent. `list_pages` / `get_page` are read-only and return absolute paths when you do need to Read something (e.g. `data.snapshotPath`).

## Choosing a kind

| Kind | Sandbox | Use for |
|------|---------|---------|
| `static` | no JS | fixed documents, formatted reports |
| `interactive` | JS + forms | calculators, explorers, tools |
| `live` | JS + receives snapshot updates while open | dashboards fed by `write_page_data` |

## Data model

Each page has a small data store with two shapes:

- **kv** — `key → any JSON value` (objects/arrays fine). For current values: settings, latest totals, status objects.
- **series** — named timeseries of `{ t: epoch ms, v: number }` points. For anything charted over time. `(series, t)` writes are idempotent upserts, so re-running a write is safe.

`write_page_data` applies one transactional patch and regenerates `data/snapshot.json`:

```
write_page_data({
  slug: "build-health",
  set: { summary: { total: 42, failing: 3 }, updatedBy: "agent" },
  delete: ["obsolete_key"],
  appendSeries: { "ci.duration_ms": [{ v: 84213 }, { t: 1756165200000, v: 79544 }] },
  pruneSeries: { "ci.duration_ms": 1748000000000 }
})
```

The snapshot the page receives looks like:

```json
{
  "version": 1,
  "generatedAt": 1756191234567,
  "kv": { "summary": { "total": 42, "failing": 3 } },
  "series": { "ci.duration_ms": [ { "t": 1756165200000, "v": 79544 } ] }
}
```

Series are ascending by `t`, capped at the newest 1000 points per series. The store itself is bounded too: at most **1000 kv keys** and **100 distinct series** per page — a write that would exceed either limit fails whole (rolled back) with a clear error. Design keys/series as stable names you update, not as ever-growing sets (put lists inside one kv value; don't mint `item-<id>` keys or per-day series names).

## Authoring page HTML

Rules that make pages work everywhere (local sandbox AND published copies):

1. **One full standalone HTML document.** Inline ALL CSS and JS. No external requests of any kind — published copies are served with `connect-src 'none'` (all network egress blocked), so CDN scripts, fonts, or fetch() calls would break them. Render charts with inline SVG/canvas you draw yourself.
2. **Data arrives via the bridge, not fetch.** The host injects the data snapshot through `postMessage`; `live` pages get replacement snapshots automatically whenever the data changes.
3. **The iframe is opaque-origin** (`sandbox` without `allow-same-origin`): no cookies, no localStorage, no parent DOM access. Keep state in JS variables.

### Bridge snippet (copy-paste)

```html
<script>
  let nonce = null;

  function render(snapshot) {
    // snapshot = { version, generatedAt, kv, series } or null (no data yet)
    // ... update the DOM ...
  }

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || msg.protocol !== 'craft-pages/v1') return;
    if (msg.type === 'init') {           // { page: {slug, kind}, nonce, snapshot, grants }
      nonce = msg.payload.nonce;
      handleGrants(msg.payload.grants);  // [{ id, action, expiresAt }] — usable grants
      render(msg.payload.snapshot);
    } else if (msg.type === 'data') {    // live pages: replacement snapshot
      render(msg.payload.snapshot);
    } else if (msg.type === 'action-result') {
      handleActionResult(msg.payload.result);  // { requestId, ok, status?, body?, error?, durationMs }
    } else if (msg.type === 'grants') {  // reply to 'grant-request' + pushed on grant changes
      handleGrants(msg.payload.grants);
    }
  });

  // Ask the host for init (also delivered automatically after load)
  window.parent.postMessage({ protocol: 'craft-pages/v1', type: 'ready' }, '*');
</script>
```

### Opening external links

Sandboxed pages cannot navigate. Ask the host (only http/https URLs, requires a user gesture):

```js
window.parent.postMessage({ protocol: 'craft-pages/v1', type: 'open-url', nonce, url: 'https://example.com' }, '*');
```

## Source actions (grants)

Interactive pages can trigger calls against the workspace's sources (e.g. a "Send email" button using a connected Google source) — **without ever seeing credentials**. The page posts an action request; the host validates it against a **grant** and executes server-side.

```js
window.parent.postMessage({
  protocol: 'craft-pages/v1',
  type: 'action',
  requestId: crypto.randomUUID(),
  nonce,                                   // from init — required
  grantId: 'grant_1a2b3c4d',               // an approved grant on this page
  invocation: { kind: 'api', method: 'GET', path: '/health' }  // must match the grant
}, '*');
// Result arrives as an 'action-result' message (match by requestId).
```

### Requesting grants from inside the page

A page asks for the grants it needs with a `grant-request` message; the host shows the user
an approval dialog and answers with a `grants` message (the full list of currently usable
grants). Match grants to needs by comparing `action` descriptors — do NOT hardcode grant ids.

```js
let grants = [];                            // [{ id, action, expiresAt }]
function grantFor(action) {                 // find by descriptor, never by id
  return grants.find(g => g.action.kind === action.kind
    && g.action.sourceSlug === action.sourceSlug
    && (action.kind === 'mcp' ? g.action.toolName === action.toolName
        : g.action.method === action.method && g.action.pathPattern === action.pathPattern));
}
function handleGrants(list) { grants = list || []; /* enable/disable buttons */ }

const NEEDS = [
  { key: 'read',  description: 'Refresh the task list',
    action: { kind: 'mcp', sourceSlug: 'craft-private', toolName: 'craft_read' } },
  { key: 'write', description: 'Add and complete tasks',
    action: { kind: 'mcp', sourceSlug: 'craft-private', toolName: 'craft_write' } },
];
// After init: request anything still missing (max 8 entries per request).
if (NEEDS.some(n => !grantFor(n.action))) {
  window.parent.postMessage({ protocol: 'craft-pages/v1', type: 'grant-request', nonce, requests: NEEDS }, '*');
}
```

Denied descriptors are remembered for the rest of the render — re-requesting them is answered
with the current grant list instead of another dialog, so pages cannot nag. Design for denial:
keep the page useful with buttons disabled and show what approval would unlock.

What you must know about grants:

- Grants are **user-approved capabilities** persisted in the page config: `{ kind: 'api', sourceSlug, method, pathPattern }` (anchored regex), `{ kind: 'mcp', sourceSlug, toolName }`, or `{ kind: 'script', script, runtime?, args? }` (see below). You cannot mint them with a session tool — the page requests them (`grant-request`) and the user approves them in the host dialog.
- Grants are bound to the **exact content digest** at approval time and have a hard expiry (30 days). Editing the page's HTML invalidates all grants by design — the page should simply re-request on next open.
- The user can **remove any approval at any time** (page ⋯ menu → Approved actions, or inline in the Share dialog). Open renders receive an updated `grants` message when that happens, so drive button state from `handleGrants` instead of caching the init-time list.
- If a granted source **loses authentication**, actions fail fast with an error starting with `source-auth-required` (e.g. `source-auth-required: reconnect "gmail" in the app`). The host shows a reconnect banner above the page. Treat it as retryable: show a "reconnect in the app" hint and let the user simply click again after reconnecting — do not permanently disable the button.
- Only **api GET** actions may run without a user gesture. Everything else — api non-GET, **every mcp tool** (opaque: it may write), and **every script** — requires a fresh user gesture inside the page (button click): fire the action directly from the click handler, never from a timer or on load. For data that should be visible on open, render from the snapshot and make live calls button-driven.
- Per-frame caps: 5 requests in flight, 1 mutating at a time, 30/minute. Cancel with `{ type: 'action-cancel', requestId, nonce }`.
- Published (shared) copies never execute actions — viewers get `public-actions-disabled`.

`get_page` lists existing grants with a `stale` flag (digest mismatch or expired).

## Unsupported features in U Agents

Do not create script grants, scheduled refresh specs, or public links. These requests are rejected by the host. Existing schedules and grants may remain in imported page metadata, but are not executed. You may clear a legacy schedule with `update_page` and `refresh: null` when the user requests removal. Use `write_page_data` for explicit updates and approved API/MCP grants for source actions.

## Starter template

```html
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Build Health</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; margin: 24px; color: #1a1a1a; }
  .metric { font-size: 40px; font-weight: 700; }
  .muted { color: #777; font-size: 12px; }
  svg { width: 100%; height: 160px; }
</style>
</head>
<body>
  <h1>Build Health</h1>
  <div class="metric" id="total">—</div>
  <div class="muted" id="updated">waiting for data…</div>
  <svg id="chart" viewBox="0 0 600 160" preserveAspectRatio="none"></svg>

<script>
  let nonce = null;

  function render(snapshot) {
    if (!snapshot) return;
    const summary = snapshot.kv.summary || {};
    document.getElementById('total').textContent = summary.total ?? '—';
    document.getElementById('updated').textContent = 'updated ' + new Date(snapshot.generatedAt).toLocaleString();

    const points = snapshot.series['ci.duration_ms'] || [];
    const max = Math.max(1, ...points.map(p => p.v));
    const w = 600 / Math.max(1, points.length);
    document.getElementById('chart').innerHTML = points
      .map((p, i) => `<rect x="${i * w}" y="${160 - (p.v / max) * 150}" width="${Math.max(1, w - 2)}" height="${(p.v / max) * 150}" fill="#4f7cff"/>`)
      .join('');
  }

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || msg.protocol !== 'craft-pages/v1') return;
    if (msg.type === 'init') { nonce = msg.payload.nonce; render(msg.payload.snapshot); }
    else if (msg.type === 'data') { render(msg.payload.snapshot); }
  });
  window.parent.postMessage({ protocol: 'craft-pages/v1', type: 'ready' }, '*');
</script>
</body>
</html>
```

## Recipes

- **"Make me a dashboard"** → `create_page` (kind `live`, content) → seed data with `write_page_data`. Explain that scheduled Page refresh is unavailable.
- **"Track this number over time"** → page with a series chart; append points with `write_page_data` whenever you learn a new value (idempotent by timestamp).
- **"Save this report"** → `create_page` (kind `static`, fully inline HTML). The page remains local; public publishing is unavailable.
- **Iterating on a page** → `update_page` with new `content`; warn the user that existing grants go stale on content changes.
