// CI-only smoke test: execute installed runtimes with synthetic loopback traffic.
import { existsSync, mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const [appArgument, bunArgument, reportArgument] = process.argv.slice(2)
if (!appArgument || !bunArgument || !reportArgument) throw new Error('Expected app root, packaged Bun and report path')
if (!process.env.U_AGENTS_CONFIG_DIR || process.env.U_AGENTS_CONFIG_DIR !== process.env.CRAFT_CONFIG_DIR) {
  throw new Error('Dual isolated config roots must be set before starting Bun')
}
const app = resolve(appArgument), bun = resolve(bunArgument), report = resolve(reportArgument)
const work = mkdtempSync(join(tmpdir(), 'u-agents-installed-smoke-'))
const platform = process.platform === 'win32' ? 'win32-x64' : `darwin-${process.arch}`
const required = [
  'dist/main.cjs', 'dist/bootstrap-preload.cjs', 'dist/browser-toolbar-preload.cjs', 'dist/interceptor.cjs',
  'resources/pi-agent-server/index.js', 'resources/pi-agent-server/node_modules/@silvia-odwyer/photon-node/photon_rs_bg.wasm',
  'resources/pi-agent-server/photon_rs_bg.wasm', 'resources/pi-agent-server/node_modules/quickjs-wasi/quickjs.wasm',
  'node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs',
  `node_modules/@anthropic-ai/claude-agent-sdk-binary/claude${process.platform === 'win32' ? '.exe' : ''}`,
  `node_modules/@vscode/ripgrep/bin/rg${process.platform === 'win32' ? '.exe' : ''}`,
  'packages/shared/src/config/u-agents-feature-policy.ts',
  `resources/bin/${platform}/uv${process.platform === 'win32' ? '.exe' : ''}`,
]
for (const name of required) if (!existsSync(join(app, name))) throw new Error(`Missing packaged file: ${name}`)
if (!existsSync(bun)) throw new Error('Packaged Bun missing')

function execute(args: string[]) {
  const output = Bun.spawnSync([bun, ...args], { cwd: work, env: process.env, stdout: 'pipe', stderr: 'pipe' })
  if (output.exitCode !== 0) throw new Error(`Packaged runtime failed: ${output.stderr.toString().slice(0, 2000)}`)
  return output.stdout.toString().trim()
}
const version = execute(['--version'])
if (version !== '1.3.12') throw new Error(`Unexpected packaged Bun: ${version}`)
const preload = execute(['--preload', join(app, 'packages/shared/src/unified-network-interceptor.ts'), '-e', 'console.log("INSTALLED_PRELOAD_OK")'])
if (!preload.includes('INSTALLED_PRELOAD_OK')) throw new Error('Preload did not execute')
const uv = Bun.spawnSync([join(app, `resources/bin/${platform}/uv${process.platform === 'win32' ? '.exe' : ''}`), '--version'], { cwd: work, stdout: 'pipe', stderr: 'pipe' })
if (uv.exitCode !== 0) throw new Error('Packaged uv failed')
const quickjsPath = join(app, 'resources/pi-agent-server/node_modules/quickjs-wasi/dist/index.js')
const quickjsWasm = join(app, 'resources/pi-agent-server/node_modules/quickjs-wasi/quickjs.wasm')
const quickjs = execute(['-e', `const {QuickJS}=await import(${JSON.stringify(pathToFileURL(quickjsPath).href)});const q=await QuickJS.create(await Bun.file(${JSON.stringify(quickjsWasm)}).arrayBuffer());try{console.log(q.evalCode('6*7').consume(h=>h.toNumber()))}finally{q.dispose()}`])
if (quickjs !== '42') throw new Error('QuickJS result was not 42')

const bodies: any[] = []
const server = Bun.serve({ hostname: '127.0.0.1', port: Number(process.env.U_AGENTS_SMOKE_PORT ?? 0), async fetch(request) {
  if (new URL(request.url).pathname !== '/v1/chat/completions' || request.method !== 'POST') return new Response('Rejected', { status: 400 })
  bodies.push(await request.json())
  if (bodies.length > 1) return new Response('One request only', { status: 400 })
  const start = { id: 'fixture', object: 'chat.completion.chunk', created: 1, model: 'synthetic-chat', choices: [{ index: 0, delta: { role: 'assistant', content: 'PACKAGED_IMAGE_OK' }, finish_reason: null }] }
  const end = { ...start, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 } }
  return new Response(`data: ${JSON.stringify(start)}\n\ndata: ${JSON.stringify(end)}\n\ndata: [DONE]\n\n`, { headers: { 'content-type': 'text/event-stream' } })
} })
const child = Bun.spawn([bun, join(app, 'resources/pi-agent-server/index.js')], { cwd: work, env: process.env, stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' })
const events: any[] = []
let closed = false, stderr = ''
const reading = (async () => {
  const reader = child.stdout.getReader(), decoder = new TextDecoder(); let pending = ''
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break
      pending += decoder.decode(part.value, { stream: true })
      let end: number
      while ((end = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, end); pending = pending.slice(end + 1)
        if (line.trim()) events.push(JSON.parse(line))
      }
    }
  } finally { closed = true; reader.releaseLock() }
})()
const errorReading = new Response(child.stderr).text().then(text => { stderr = text.slice(-3000) })
function send(value: object) { child.stdin.write(JSON.stringify(value) + '\n'); child.stdin.flush() }
async function until(predicate: (value: any) => boolean) {
  const deadline = Date.now() + 30_000
  while (!events.some(predicate)) {
    if (closed || events.some(value => value.type === 'error')) throw new Error('Packaged Pi stopped: ' + stderr)
    if (Date.now() > deadline) throw new Error('Packaged Pi deadline exceeded')
    await Bun.sleep(30)
  }
}
try {
  const sessionPath = join(work, 'sessions/package-fixture'); mkdirSync(sessionPath, { recursive: true })
  send({ type: 'init', apiKey: 'synthetic-token', model: 'synthetic-chat', cwd: work, workingDirectory: work,
    workspaceRootPath: work, sessionId: 'package-fixture', sessionPath, plansFolderPath: join(work, 'plans'),
    thinkingLevel: 'off', providerType: 'pi_compat', authType: 'api_key_with_endpoint', baseUrl: `http://127.0.0.1:${server.port}/v1`,
    customEndpoint: { api: 'openai-completions', supportsImages: true, maxTokens: 32768 }, customModels: [{ id: 'synthetic-chat', supportsImages: true }],
    piAuth: { provider: 'openai', credential: { type: 'api_key', key: 'synthetic-token' } } })
  await until(value => value.type === 'ready')
  send({ type: 'register_tools', tools: [] })
  send({ type: 'prompt', id: 'image-fixture', message: 'Return PACKAGED_IMAGE_OK without tools.', systemPrompt: 'Synthetic fixture. Do not call tools.',
    images: [{ type: 'image', mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAYCAIAAAAUMWhjAAAAJElEQVR4nGNQaDhAU8QwasGoBaMWjFowasGoBaMWjFowNCwAAMJYID0cFZq7AAAAAElFTkSuQmCC' }] })
  await until(value => value.type === 'event' && value.event?.type === 'agent_end')
  if (bodies.length !== 1) throw new Error('Pi request count differs from one')
  const body = bodies[0]
  const images = body.messages.flatMap((message: any) => Array.isArray(message.content) ? message.content.filter((block: any) => block.type === 'image_url') : [])
  if (images.length !== 1 || !(images[0].image_url.url as string).startsWith('data:image/png;base64,')) throw new Error('Pi did not send the packaged image')
  if ((body.max_completion_tokens ?? body.max_tokens) !== 32768) throw new Error('Output cap was not preserved')
  if (!JSON.stringify(events).includes('PACKAGED_IMAGE_OK')) throw new Error('Pi reply missing')
  await Bun.write(report, JSON.stringify({ result: 'PASS', commit: process.env.GITHUB_SHA ?? null, platform, bun: version,
    uv: uv.stdout.toString().trim(), preload: true, quickjs: 42, pi: true, photonImageCount: images.length, outputCap: 32768,
    requests: 1, syntheticOnly: true, realGatewayRequests: 0, configRoot: process.env.U_AGENTS_CONFIG_DIR }, null, 2))
  console.log('PACKAGED_RUNTIME_CHECK_PASS')
} finally {
  try { send({ type: 'shutdown' }) } catch {}
  const exited = await Promise.race([child.exited.then(() => true), Bun.sleep(3000).then(() => false)])
  if (!exited) { child.kill(); await child.exited }
  await Promise.allSettled([reading, errorReading]); server.stop(true)
}
