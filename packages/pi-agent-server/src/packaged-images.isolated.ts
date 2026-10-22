// U-API: exercise the actual bundled Pi server outside the repository, including Photon WASM.
import { expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { copyPiAgentServer, type Platform, type Arch } from '../../../scripts/build/common'

test('packaged Pi sends the image and configured output cap without reading a build-machine WASM path', async () => {
  const repo = resolve(import.meta.dir, '../../..')
  const root = mkdtempSync(join(tmpdir(), 'packaged-pi-image-'))
  const bodies: any[] = []
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
    bodies.push(await request.json())
    const chunk = { id: 'fixture', object: 'chat.completion.chunk', created: 1, model: 'synthetic-chat',
      choices: [{ index: 0, delta: { role: 'assistant', content: 'PACKAGED_IMAGE_OK' }, finish_reason: null }] }
    const end = { ...chunk, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 } }
    return new Response(`data: ${JSON.stringify(chunk)}\n\ndata: ${JSON.stringify(end)}\n\ndata: [DONE]\n\n`,
      { headers: { 'content-type': 'text/event-stream' } })
  } })
  let child: ReturnType<typeof Bun.spawn> | undefined
  try {
    const build = Bun.spawnSync([process.execPath, 'run', 'server:build:subprocess'], { cwd: repo, stdout: 'pipe', stderr: 'pipe' })
    expect(build.exitCode, build.stderr.toString()).toBe(0)
    const app = join(root, 'app')
    copyPiAgentServer({ rootDir: repo, electronDir: app, platform: process.platform as Platform, arch: process.arch as Arch,
      upload: false, uploadLatest: false, uploadScript: false })
    const guard = join(root, 'wasm-build-path-guard.cjs')
    writeFileSync(guard, `const fs = require('node:fs'); const original = fs.readFileSync;
      fs.readFileSync = function(file, ...args) {
        if (String(file).startsWith(${JSON.stringify(repo)}) && String(file).endsWith('photon_rs_bg.wasm')) {
          const error = new Error('Build-machine WASM path is unavailable in an installed app'); error.code = 'EPERM'; throw error;
        }
        return original.call(this, file, ...args);
      };`)
    child = Bun.spawn([process.execPath, '--preload', guard, join(app, 'resources/pi-agent-server/index.js')],
      { cwd: root, stdin: 'pipe', stdout: 'pipe', stderr: 'pipe', env: process.env })
    const events: any[] = []
    let changed = () => {}
    const reading = (async () => {
      let buffered = ''
      const reader = (child!.stdout as ReadableStream<Uint8Array>).getReader()
      const decoder = new TextDecoder()
      while (true) {
        const part = await reader.read()
        if (part.done) break
        buffered += decoder.decode(part.value, { stream: true })
        let end: number
        while ((end = buffered.indexOf('\n')) >= 0) {
          const line = buffered.slice(0, end); buffered = buffered.slice(end + 1)
          if (line.trim()) { events.push(JSON.parse(line)); changed() }
        }
      }
    })()
    async function until(predicate: (value: any) => boolean) {
      const deadline = Date.now() + 15000
      while (!events.some(predicate)) {
        const error = events.find(value => value.type === 'error')
        if (error) throw new Error(JSON.stringify(error))
        if (Date.now() >= deadline) throw new Error('Pi fixture timeout: ' + JSON.stringify(events.slice(-2)))
        await new Promise<void>(resolve => {
          const timer = setTimeout(resolve, 100)
          changed = () => { clearTimeout(timer); resolve() }
        })
      }
    }
    const send = (value: object) => (child!.stdin as import('bun').FileSink).write(JSON.stringify(value) + '\n')
    const sessionPath = join(root, 'sessions', 'package-fixture')
    mkdirSync(sessionPath, { recursive: true })
    send({ type: 'init', apiKey: 'synthetic-token', model: 'synthetic-chat', cwd: root, workingDirectory: root,
      workspaceRootPath: root, sessionId: 'package-fixture', sessionPath, plansFolderPath: join(root, 'plans'),
      thinkingLevel: 'off', providerType: 'pi_compat', authType: 'api_key_with_endpoint',
      baseUrl: `http://127.0.0.1:${server.port}/v1`,
      customEndpoint: { api: 'openai-completions', supportsImages: true, maxTokens: 32768 },
      customModels: [{ id: 'synthetic-chat', supportsImages: true }],
      piAuth: { provider: 'openai', credential: { type: 'api_key', key: 'synthetic-token' } } })
    await until(value => value.type === 'ready')
    send({ type: 'prompt', id: 'image-fixture', message: 'Return PACKAGED_IMAGE_OK without tools.',
      systemPrompt: 'Synthetic fixture. Do not call tools.', images: [{ type: 'image', mimeType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAYCAIAAAAUMWhjAAAAJElEQVR4nGNQaDhAU8QwasGoBaMWjFowasGoBaMWjFowNCwAAMJYID0cFZq7AAAAAElFTkSuQmCC' }] })
    await until(value => value.type === 'event' && value.event.type === 'agent_end')
    expect(bodies).toHaveLength(1)
    expect(bodies[0].max_completion_tokens ?? bodies[0].max_tokens).toBe(32768)
    const images = bodies[0].messages.flatMap((message: any) => Array.isArray(message.content)
      ? message.content.filter((block: any) => block.type === 'image_url') : [])
    expect(images).toHaveLength(1)
    expect(images[0].image_url.url).toStartWith('data:image/png;base64,')
    expect(JSON.stringify(events)).toContain('PACKAGED_IMAGE_OK')
    send({ type: 'shutdown' }); await child.exited; await reading
  } finally {
    if (child && child.exitCode === null) { child.kill(); await child.exited }
    server.stop(true)
    rmSync(root, { recursive: true, force: true })
  }
}, 30000)
