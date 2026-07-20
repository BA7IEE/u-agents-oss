// U-API: Images host service 的exact目录、单claim、multipart与零网络失败回归（16 §11.1）。
import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtemp, mkdir, readdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import sharp from 'sharp'
import type { ImageProcessor } from '../runtime/platform'
import { createHeadlessPlatform } from '../runtime/platform-headless.ts'
import { buildUApiImageManifest, executeUApiImageGeneration, U_API_IMAGE_INTERNALS_FOR_TESTS, type UApiImageManifestItem } from './u-api-image-generation.ts'

const roots: string[] = []
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.from('safe-test-image')])
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from('safe-test-image')])
const webp = Buffer.concat([Buffer.from('RIFF1234WEBP'), Buffer.from('safe-test-image')])
const processor: ImageProcessor = {
  getMetadata: async () => ({ width: 1024, height: 1024 }),
  process: async buffer => typeof buffer === 'string' ? Buffer.from(buffer) : buffer,
}

async function sessionDir(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'uapi-image-service-'))
  roots.push(root)
  await mkdir(join(root, 'attachments'))
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

function catalog(markers = true, model = 'gpt-image-2'): Response {
  return Response.json({
    data: [{
      id: model,
      supported_endpoint_types: markers
        ? ['image-generation', 'uapi-image-edit-v1', 'uapi-image-default-v1']
        : ['image-generation'],
    }],
  })
}

function imageResponse(buffer: Uint8Array = png, quality = 'medium'): Response {
  return Response.json({ data: [{ b64_json: Buffer.from(buffer).toString('base64'), quality }] })
}

describe('executeUApiImageGeneration', () => {
  it('accepts only one exact catalog entry carrying the complete versioned marker set', () => {
    const select = U_API_IMAGE_INTERNALS_FOR_TESTS.selectModel
    expect(select({ data: [
      { id: 'gpt-image-2', supported_endpoint_types: ['image-generation', 'uapi-image-edit-v1', 'uapi-image-default-v1'] },
      { id: 'another', supported_endpoint_types: ['image-generation', 'uapi-image-edit-v1', 'uapi-image-default-v1'] },
    ] })).toBeNull()
    expect(select({ data: [
      { id: 'same', supported_endpoint_types: ['image-generation', 'uapi-image-edit-v1', 'uapi-image-default-v1'] },
      { id: 'same', supported_endpoint_types: ['image-generation'] },
    ] })).toBeNull()
    expect(select({ data: [
      { id: 'gpt-image-2', supported_endpoint_types: ['image-generation'] },
      { id: 'edit-marker-holder', supported_endpoint_types: ['uapi-image-edit-v1', 'uapi-image-default-v1'] },
    ] })).toBeNull()
    expect(select({ data: [
      { id: 'misleading-image-name', supported_endpoint_types: ['chat'] },
    ] })).toBeNull()
  })

  it('freezes only real, in-session, non-symlink image candidates behind img_N refs', async () => {
    const root = await sessionDir()
    const valid = join(root, 'attachments', 'valid.png')
    const link = join(root, 'attachments', 'linked.png')
    await writeFile(valid, png)
    await symlink(valid, link)
    const outsideRoot = await mkdtemp(join(tmpdir(), 'uapi-image-outside-'))
    roots.push(outsideRoot)
    const outside = join(outsideRoot, 'outside.png')
    await writeFile(outside, png)

    const manifest = await buildUApiImageManifest(root, [
      { path: link, displayName: 'link' },
      { path: outside, displayName: 'outside' },
      { path: valid, displayName: '  Valid\u0000 image  ' },
      { path: valid, displayName: 'duplicate' },
    ], processor)
    expect([...manifest.keys()]).toEqual(['img_1'])
    expect(manifest.get('img_1')).toMatchObject({
      path: await realpath(valid),
      displayName: 'Valid  image',
      mimeType: 'image/png',
      width: 1024,
      height: 1024,
    })
  })

  it('selects the unique exact marker model and claims once before one generation POST', async () => {
    const root = await sessionDir()
    const calls: string[] = []
    let claims = 0
    const result = await executeUApiImageGeneration(
      { prompt: 'draw a neutral square' },
      {
        sessionPath: root,
        connectionSlug: 'u-api-default',
        connectionBaseUrl: 'https://token.u-studio.cn/v1',
        getToken: async () => 'test-token',
        manifest: new Map(),
        imageProcessor: processor,
        controller: new AbortController(),
        claim: () => { claims += 1; return true },
        fetchFn: async (url, init) => {
          calls.push(`${init?.method ?? 'GET'} ${String(url)}`)
          return calls.length === 1 ? catalog() : imageResponse()
        },
      },
    )
    expect(result.isError).toBe(false)
    expect(result.claimed).toBe(true)
    expect(claims).toBe(1)
    expect(calls).toEqual([
      'GET https://token.u-studio.cn/v1/models',
      'POST https://token.u-studio.cn/v1/images/generations',
    ])
    expect((await readdir(join(root, 'downloads'))).length).toBe(1)
  })

  it('uses the catalog exact model id and the frozen high-quality landscape payload', async () => {
    const root = await sessionDir()
    let payload: unknown = null
    const result = await executeUApiImageGeneration(
      { prompt: 'draw a wide cover', aspectRatio: '3:2', preset: 'high' },
      {
        sessionPath: root,
        connectionSlug: 'u-api-default',
        connectionBaseUrl: 'https://token.u-studio.cn/v1',
        getToken: async () => 'test-token',
        manifest: new Map(),
        imageProcessor: processor,
        controller: new AbortController(),
        claim: () => true,
        fetchFn: async (url, init) => {
          if (String(url).endsWith('/models')) return catalog(true, 'actual-image-route-2027')
          payload = JSON.parse(String(init?.body)) as Record<string, unknown>
          return imageResponse(png, 'high')
        },
      },
    )
    expect(result.isError).toBe(false)
    expect(payload).toEqual({
      model: 'actual-image-route-2027',
      prompt: 'draw a wide cover\n\nCanvas constraint: use a landscape 3:2 canvas.',
      n: 1,
      size: '1536x1024',
      quality: 'high',
      response_format: 'b64_json',
    })
    expect(result.text).toContain('"gateway_model_id":"actual-image-route-2027"')
  })

  it('stops after catalog resolution when the host claim is no longer current', async () => {
    const root = await sessionDir()
    const calls: string[] = []
    const result = await executeUApiImageGeneration({ prompt: 'draw once' }, {
      sessionPath: root,
      connectionSlug: 'u-api-default',
      connectionBaseUrl: 'https://token.u-studio.cn/v1',
      getToken: async () => 'test-token',
      manifest: new Map(),
      imageProcessor: processor,
      controller: new AbortController(),
      claim: () => false,
      fetchFn: async (url, init) => {
        calls.push(`${init?.method ?? 'GET'} ${String(url)}`)
        return catalog()
      },
    })
    expect(result.text).toContain('"charge_state":"not_sent"')
    expect(calls).toEqual(['GET https://token.u-studio.cn/v1/models'])
  })

  it('uses verified bytes in multipart edits without original filenames', async () => {
    const root = await sessionDir()
    const imagePath = join(root, 'attachments', 'private-original-name.png')
    await writeFile(imagePath, png)
    const item: UApiImageManifestItem = {
      ref: 'img_1', path: imagePath, displayName: 'Current attachment 1',
      mimeType: 'image/png', width: 1024, height: 1024,
    }
    let editBody: FormData | null = null
    const result = await executeUApiImageGeneration(
      { prompt: 'change the background', inputImages: [{ ref: 'img_1', role: 'edit_target' }] },
      {
        sessionPath: root,
        connectionSlug: 'u-api-2',
        connectionBaseUrl: 'https://token.u-studio.cn/v1/',
        getToken: async () => 'test-token',
        manifest: new Map([['img_1', item]]),
        imageProcessor: processor,
        controller: new AbortController(),
        claim: () => true,
        fetchFn: async (url, init) => {
          if (String(url).endsWith('/models')) return catalog()
          editBody = init?.body as FormData
          return imageResponse()
        },
      },
    )
    expect(result.isError).toBe(false)
    expect(editBody).toBeInstanceOf(FormData)
    expect(editBody!.getAll('image[]')).toHaveLength(1)
    const imagePart = editBody!.getAll('image[]')[0] as File
    expect(imagePart.name).toBe('image-1.png')
  })

  it('sends PNG, JPEG, and WebP references with generated multipart filenames', async () => {
    const root = await sessionDir()
    const fixtures = [
      { buffer: png, ext: 'png', mimeType: 'image/png' as const },
      { buffer: jpeg, ext: 'jpg', mimeType: 'image/jpeg' as const },
      { buffer: webp, ext: 'webp', mimeType: 'image/webp' as const },
    ]
    const manifest = new Map<string, UApiImageManifestItem>()
    for (const [index, fixture] of fixtures.entries()) {
      const path = join(root, 'attachments', `private-${index}.${fixture.ext}`)
      await writeFile(path, fixture.buffer)
      const ref = `img_${index + 1}`
      manifest.set(ref, { ref, path, displayName: `Image ${index + 1}`, mimeType: fixture.mimeType, width: 1024, height: 1024 })
    }
    let body: FormData | null = null
    const result = await executeUApiImageGeneration({
      prompt: 'combine the three references',
      inputImages: [
        { ref: 'img_1', role: 'subject_reference' },
        { ref: 'img_2', role: 'style_reference' },
        { ref: 'img_3', role: 'composition_reference' },
      ],
    }, {
      sessionPath: root,
      connectionSlug: 'u-api-default',
      connectionBaseUrl: 'https://token.u-studio.cn/v1',
      getToken: async () => 'test-token',
      manifest,
      imageProcessor: processor,
      controller: new AbortController(),
      claim: () => true,
      fetchFn: async (url, init) => {
        if (String(url).endsWith('/models')) return catalog()
        body = init?.body as FormData
        return imageResponse()
      },
    })
    expect(result.isError).toBe(false)
    const parts = body!.getAll('image[]') as File[]
    expect(parts.map(part => [part.name, part.type])).toEqual([
      ['image-1.png', 'image/png'],
      ['image-2.jpg', 'image/jpeg'],
      ['image-3.webp', 'image/webp'],
    ])
  })

  it('decodes real PNG, JPEG, and WebP bytes before a multipart edit', async () => {
    const root = await sessionDir()
    const realProcessor = createHeadlessPlatform().imageProcessor
    const seed = sharp({ create: { width: 1024, height: 1024, channels: 3, background: '#5b6cff' } })
    const fixtures = [
      { buffer: await seed.clone().png().toBuffer(), ext: 'png' },
      { buffer: await seed.clone().jpeg().toBuffer(), ext: 'jpg' },
      { buffer: await seed.clone().webp().toBuffer(), ext: 'webp' },
    ]
    const candidates = []
    for (const [index, fixture] of fixtures.entries()) {
      const path = join(root, 'attachments', `private-real-${index}.${fixture.ext}`)
      await writeFile(path, fixture.buffer)
      candidates.push({ path, displayName: `Real image ${index + 1}` })
    }
    const manifest = await buildUApiImageManifest(root, candidates, realProcessor)
    let body: FormData | null = null
    const result = await executeUApiImageGeneration({
      prompt: 'combine real images',
      inputImages: [
        { ref: 'img_1', role: 'edit_target' },
        { ref: 'img_2', role: 'subject_reference' },
        { ref: 'img_3', role: 'style_reference' },
      ],
    }, {
      sessionPath: root,
      connectionSlug: 'u-api-default',
      connectionBaseUrl: 'https://token.u-studio.cn/v1',
      getToken: async () => 'test-token',
      manifest,
      imageProcessor: realProcessor,
      controller: new AbortController(),
      claim: () => true,
      fetchFn: async (url, init) => {
        if (String(url).endsWith('/models')) return catalog()
        body = init?.body as FormData
        return imageResponse(fixtures[0]!.buffer)
      },
    })
    expect(result.isError).toBe(false)
    expect((body!.getAll('image[]') as File[]).map(file => [file.name, file.type])).toEqual([
      ['image-1.png', 'image/png'],
      ['image-2.jpg', 'image/jpeg'],
      ['image-3.webp', 'image/webp'],
    ])
  })

  it('rejects dangerous claimed responses without saving a file', async () => {
    const cases = [
      Response.json({ data: [{ url: 'https://attacker.invalid/image.png' }] }),
      Response.json({ data: [{ b64_json: png.toString('base64') }, { b64_json: png.toString('base64') }] }),
      Response.json({ data: [{ b64_json: 'not-an-image' }] }),
    ]
    for (const response of cases) {
      const root = await sessionDir()
      const result = await executeUApiImageGeneration({ prompt: 'draw' }, {
        sessionPath: root,
        connectionSlug: 'u-api-default',
        connectionBaseUrl: 'https://token.u-studio.cn/v1',
        getToken: async () => 'test-token',
        manifest: new Map(),
        imageProcessor: processor,
        controller: new AbortController(),
        claim: () => true,
        fetchFn: async url => String(url).endsWith('/models') ? catalog() : response,
      })
      expect(result.text).toContain('"category":"result_invalid"')
      expect(result.text).toContain('"charge_state":"possibly_charged"')
      await expect(readdir(join(root, 'downloads'))).rejects.toThrow()
    }
  })

  it('does not follow a pre-existing downloads symlink when saving a claimed result', async () => {
    const root = await sessionDir()
    const outside = await mkdtemp(join(tmpdir(), 'uapi-image-downloads-outside-'))
    roots.push(outside)
    await symlink(outside, join(root, 'downloads'))
    const result = await executeUApiImageGeneration({ prompt: 'draw' }, {
      sessionPath: root,
      connectionSlug: 'u-api-default',
      connectionBaseUrl: 'https://token.u-studio.cn/v1',
      getToken: async () => 'test-token',
      manifest: new Map(),
      imageProcessor: processor,
      controller: new AbortController(),
      claim: () => true,
      fetchFn: async url => String(url).endsWith('/models') ? catalog() : imageResponse(),
    })
    expect(result.text).toContain('"category":"result_invalid"')
    expect(await readdir(outside)).toEqual([])
    await expect(readFile(join(outside, 'generated-image.png'))).rejects.toThrow()
  })

  it('fails closed before POST for wrong connection or missing unique markers', async () => {
    const root = await sessionDir()
    let calls = 0
    const baseDeps = {
      sessionPath: root,
      getToken: async () => 'test-token',
      manifest: new Map<string, UApiImageManifestItem>(),
      imageProcessor: processor,
      controller: new AbortController(),
      claim: () => true,
      fetchFn: async () => { calls += 1; return catalog(false) },
    }
    const wrong = await executeUApiImageGeneration({ prompt: 'draw' }, {
      ...baseDeps, connectionSlug: 'other', connectionBaseUrl: 'https://example.com/v1',
    })
    expect(wrong.isError).toBe(true)
    expect(calls).toBe(0)
    const unconfigured = await executeUApiImageGeneration({ prompt: 'draw' }, {
      ...baseDeps, connectionSlug: 'u-api-default', connectionBaseUrl: 'https://token.u-studio.cn/v1',
    })
    expect(unconfigured.text).toContain('service_unconfigured')
    expect(calls).toBe(1)
  })
})
