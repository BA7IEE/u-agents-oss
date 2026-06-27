import { describe, expect, it } from 'bun:test'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { pathToFileURL } from 'url'
import { getPiModelsForAuthProvider } from '../models-pi.ts'

const PI_ANTHROPIC_OPUS_DEFAULT = getPiModelsForAuthProvider('anthropic').some(m => m.id === 'pi/claude-opus-4-8')
  ? 'pi/claude-opus-4-8'
  : 'pi/claude-opus-4-7'
const PI_ANTHROPIC_OPUS_DEFAULT_NAME = PI_ANTHROPIC_OPUS_DEFAULT.endsWith('4-8') ? 'Opus 4.8' : 'Opus 4.7'
const PI_BEDROCK_OPUS_DEFAULT = getPiModelsForAuthProvider('amazon-bedrock').some(m => m.id === 'pi/us.anthropic.claude-opus-4-8')
  ? 'pi/us.anthropic.claude-opus-4-8'
  : 'pi/us.anthropic.claude-opus-4-7'
const PI_BEDROCK_OPUS_DEFAULT_NAME = PI_BEDROCK_OPUS_DEFAULT.endsWith('4-8') ? 'Opus 4.8' : 'Opus 4.7'

const STORAGE_MODULE_PATH = pathToFileURL(join(import.meta.dir, '..', 'storage.ts')).href
const PI_RESOLVER_SETUP_PATH = pathToFileURL(join(import.meta.dir, '..', '..', '..', 'tests', 'setup', 'register-pi-model-resolver.ts')).href

function setupWorkspaceConfigDir() {
  const configDir = mkdtempSync(join(tmpdir(), 'u-agents-config-'))
  const workspaceRoot = join(configDir, 'workspaces', 'my-workspace')
  mkdirSync(workspaceRoot, { recursive: true })

  writeFileSync(
    join(workspaceRoot, 'config.json'),
    JSON.stringify(
      {
        id: 'ws-config-1',
        name: 'My Workspace',
        slug: 'my-workspace',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      null,
      2,
    ),
    'utf-8',
  )

  return { configDir, workspaceRoot, configPath: join(configDir, 'config.json') }
}

function writeRootConfig(configPath: string, workspaceRoot: string, config: Record<string, unknown> | unknown[]) {
  // U-API: 兼容两种调用约定——上游 v0.10.4 新增迁移测试按数组传 llmConnections，我方既有 U-API lockdown 测试传 config 对象
  const configObject = Array.isArray(config) ? { llmConnections: config } : config
  writeFileSync(
    configPath,
    JSON.stringify(
      {
        workspaces: [
          {
            id: 'ws-1',
            name: 'My Workspace',
            rootPath: workspaceRoot,
            createdAt: Date.now(),
          },
        ],
        activeWorkspaceId: 'ws-1',
        activeSessionId: null,
        ...configObject,
      },
      null,
      2,
    ),
    'utf-8',
  )
}

function runMigration(configDir: string) {
  const run = Bun.spawnSync([
    process.execPath,
    '--eval',
    `import '${PI_RESOLVER_SETUP_PATH}'; import { migrateLegacyLlmConnectionsConfig } from '${STORAGE_MODULE_PATH}'; migrateLegacyLlmConnectionsConfig();`,
  ], {
    env: {
      ...process.env,
      CRAFT_CONFIG_DIR: configDir,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  })

  if (run.exitCode !== 0) {
    throw new Error(
      `migration subprocess failed (exit ${run.exitCode})\nstdout:\n${run.stdout.toString()}\nstderr:\n${run.stderr.toString()}`,
    )
  }
}

function readPiApiKeyConnection(configPath: string): any {
  const migrated = JSON.parse(readFileSync(configPath, 'utf-8'))
  return migrated.llmConnections.find((c: any) => c.slug === 'pi-api-key')
}

function getModelIds(connection: any): string[] {
  return (connection.models ?? []).map((m: any) => typeof m === 'string' ? m : m.id)
}

describe('startup migration (integration)', () => {
  it('repairs broken pi-api-key openai-codex provider on startup migration', () => {
    const { configDir, workspaceRoot, configPath } = setupWorkspaceConfigDir()

    writeRootConfig(configPath, workspaceRoot, [
      {
        slug: 'pi-api-key',
        name: 'Craft Agents Backend (OpenAI)',
        providerType: 'pi',
        authType: 'api_key',
        piAuthProvider: 'openai-codex',
        createdAt: Date.now(),
        models: [],
        defaultModel: '',
      },
    ])

    runMigration(configDir)

    const connection = readPiApiKeyConnection(configPath)
    expect(connection).toBeDefined()
    expect(connection.piAuthProvider).toBe('openai')
    expect(connection.authType).toBe('api_key')
  })

  it('preserves userDefined3Tier model subsets during startup migration', () => {
    const { configDir, workspaceRoot, configPath } = setupWorkspaceConfigDir()
    const userDefinedModels = ['pi/claude-opus-4-6', 'pi/claude-sonnet-4-6', 'pi/claude-haiku-4-5']
    const migratedModels = [PI_ANTHROPIC_OPUS_DEFAULT, 'pi/claude-sonnet-4-6', 'pi/claude-haiku-4-5']

    writeRootConfig(configPath, workspaceRoot, [
      {
        slug: 'pi-api-key',
        name: 'Craft Agents Backend (Anthropic)',
        providerType: 'pi',
        authType: 'api_key',
        piAuthProvider: 'anthropic',
        modelSelectionMode: 'userDefined3Tier',
        createdAt: Date.now(),
        models: userDefinedModels,
        defaultModel: userDefinedModels[0],
      },
    ])

    runMigration(configDir)

    const connection = readPiApiKeyConnection(configPath)
    expect(connection).toBeDefined()
    expect(connection.modelSelectionMode).toBe('userDefined3Tier')
    expect(connection.models).toEqual(migratedModels)
    expect(connection.defaultModel).toBe(migratedModels[0])
  })

  it('normalizes auto mode model set back to provider defaults', () => {
    const { configDir, workspaceRoot, configPath } = setupWorkspaceConfigDir()

    writeRootConfig(configPath, workspaceRoot, [
      {
        slug: 'pi-api-key',
        name: 'Craft Agents Backend (Anthropic)',
        providerType: 'pi',
        authType: 'api_key',
        piAuthProvider: 'anthropic',
        modelSelectionMode: 'automaticallySyncedFromProvider',
        createdAt: Date.now(),
        models: ['pi/claude-haiku-4-5'],
        defaultModel: 'pi/claude-haiku-4-5',
      },
    ])

    runMigration(configDir)

    const connection = readPiApiKeyConnection(configPath)
    expect(connection).toBeDefined()
    expect(connection.modelSelectionMode).toBe('automaticallySyncedFromProvider')
    const modelIds = getModelIds(connection)
    expect(modelIds.length).toBeGreaterThan(1)
    expect(modelIds).toContain(PI_ANTHROPIC_OPUS_DEFAULT)
    expect(modelIds).toContain(connection.defaultModel)
  })

  it('repairs userDefined3Tier lists by removing invalid IDs and fixing default model', () => {
    const { configDir, workspaceRoot, configPath } = setupWorkspaceConfigDir()

    writeRootConfig(configPath, workspaceRoot, [
      {
        slug: 'pi-api-key',
        name: 'Craft Agents Backend (Anthropic)',
        providerType: 'pi',
        authType: 'api_key',
        piAuthProvider: 'anthropic',
        modelSelectionMode: 'userDefined3Tier',
        createdAt: Date.now(),
        models: ['pi/claude-opus-4-6', 'pi/not-real', 'pi/claude-haiku-4-5'],
        defaultModel: 'pi/not-real',
      },
    ])

    runMigration(configDir)

    const connection = readPiApiKeyConnection(configPath)
    expect(connection).toBeDefined()
    expect(connection.modelSelectionMode).toBe('userDefined3Tier')
    expect(connection.models).toEqual([PI_ANTHROPIC_OPUS_DEFAULT, 'pi/claude-haiku-4-5'])
    expect(connection.defaultModel).toBe(PI_ANTHROPIC_OPUS_DEFAULT)
  })

  it('falls back to provider defaults when userDefined3Tier becomes empty after filtering', () => {
    const { configDir, workspaceRoot, configPath } = setupWorkspaceConfigDir()

    writeRootConfig(configPath, workspaceRoot, [
      {
        slug: 'pi-api-key',
        name: 'Craft Agents Backend (Anthropic)',
        providerType: 'pi',
        authType: 'api_key',
        piAuthProvider: 'anthropic',
        modelSelectionMode: 'userDefined3Tier',
        createdAt: Date.now(),
        models: ['pi/not-real-1', 'pi/not-real-2'],
        defaultModel: 'pi/not-real-1',
      },
    ])

    runMigration(configDir)

    const connection = readPiApiKeyConnection(configPath)
    expect(connection).toBeDefined()
    expect(connection.modelSelectionMode).toBe('userDefined3Tier')
    const modelIds = getModelIds(connection)
    expect(modelIds.length).toBeGreaterThan(1)
    expect(modelIds).toContain(PI_ANTHROPIC_OPUS_DEFAULT)
    expect(modelIds).not.toContain('pi/not-real-1')
    expect(connection.defaultModel).toBe(modelIds[0])
  })

  it('normalizes legacy unprefixed userDefined3Tier model IDs instead of resetting', () => {
    const { configDir, workspaceRoot, configPath } = setupWorkspaceConfigDir()

    // Derive currently-valid OpenRouter IDs from the live Pi catalog. The migration
    // normalizes (pi/-prefixes) known IDs and drops unknown ones, so hardcoding a
    // specific model here makes the test brittle when models.dev drifts across Pi
    // SDK uplifts (e.g. x-ai/grok-4 aged out by 0.79.x).
    const openrouterIds = getPiModelsForAuthProvider('openrouter').map(m => m.id)
    expect(openrouterIds).toContain('pi/openrouter/auto')
    const otherPrefixed = openrouterIds.find(id => id !== 'pi/openrouter/auto')
    if (!otherPrefixed) throw new Error('expected at least two OpenRouter models in catalog')
    const expectedPrefixed = ['pi/openrouter/auto', otherPrefixed]
    const legacyUnprefixed = expectedPrefixed.map(id => id.slice('pi/'.length))

    writeRootConfig(configPath, workspaceRoot, [
      {
        slug: 'pi-api-key',
        name: 'Craft Agents Backend (OpenRouter)',
        providerType: 'pi',
        authType: 'api_key',
        piAuthProvider: 'openrouter',
        modelSelectionMode: 'userDefined3Tier',
        createdAt: Date.now(),
        models: legacyUnprefixed,
        defaultModel: legacyUnprefixed[0],
      },
    ])

    runMigration(configDir)

    const connection = readPiApiKeyConnection(configPath)
    expect(connection).toBeDefined()
    expect(connection.modelSelectionMode).toBe('userDefined3Tier')
    const modelIds = getModelIds(connection)
    expect(modelIds).toEqual(expectedPrefixed)
    expect(connection.defaultModel).toBe(expectedPrefixed[0])
  })
})

function readConfigJson(configPath: string): any {
  return JSON.parse(readFileSync(configPath, 'utf-8'))
}

describe('startup migration U-API lockdown (integration)', () => {
  it('injects the unauthenticated U-API skeleton when no LLM connections exist', () => {
    const { configDir, workspaceRoot, configPath } = setupWorkspaceConfigDir()

    writeRootConfig(configPath, workspaceRoot, {
      defaultLlmConnection: undefined,
      llmConnections: [],
    })

    runMigration(configDir)

    const migrated = readConfigJson(configPath)
    expect(migrated.defaultLlmConnection).toBe('u-api-default')
    expect(migrated.llmConnections).toHaveLength(1)
    expect(migrated.llmConnections[0]).toMatchObject({
      slug: 'u-api-default',
      name: 'U-API',
      providerType: 'pi_compat',
      baseUrl: 'https://token.u-studio.cn/v1',
      authType: 'api_key_with_endpoint',
      customEndpoint: {
        api: 'anthropic-messages',
        supportsImages: true,
      },
      models: [],
      modelSelectionMode: 'userDefined3Tier',
      piAuthProvider: 'anthropic',
    })
    expect(migrated.llmConnections[0].defaultModel).toBeUndefined()
  })

  it('filters all non-U-API connections and preserves user-selected U-API models', () => {
    const { configDir, workspaceRoot, configPath } = setupWorkspaceConfigDir()

    writeRootConfig(configPath, workspaceRoot, {
      defaultLlmConnection: 'anthropic-api',
      llmConnections: [
        {
          slug: 'anthropic-api',
          name: 'Anthropic',
          providerType: 'anthropic',
          authType: 'api_key',
          models: ['claude-sonnet-4-6'],
          defaultModel: 'claude-sonnet-4-6',
          createdAt: Date.now(),
        },
        {
          slug: 'u-api-default',
          name: '我的国产模型 Key',  // user-set rename — multi-connection soft lockdown preserves names (02 §6.2)
          providerType: 'pi',
          baseUrl: 'https://evil.example/v1',
          authType: 'api_key',
          customEndpoint: { api: 'openai-completions' },
          models: ['gpt-5.5', 'claude-sonnet-4-6'],
          defaultModel: 'gpt-5.5',
          modelSelectionMode: 'userDefined3Tier',
          createdAt: Date.now(),
        },
      ],
    })

    runMigration(configDir)

    const migrated = readConfigJson(configPath)
    expect(migrated.defaultLlmConnection).toBe('u-api-default')
    expect(migrated.llmConnections).toHaveLength(1)
    expect(migrated.llmConnections[0]).toMatchObject({
      slug: 'u-api-default',
      name: '我的国产模型 Key',  // user rename preserved; only baseUrl/providerType/authType are force-reset
      providerType: 'pi_compat',
      baseUrl: 'https://token.u-studio.cn/v1',
      authType: 'api_key_with_endpoint',
      customEndpoint: {
        api: 'openai-completions',
        supportsImages: true,
      },
      models: ['gpt-5.5', 'claude-sonnet-4-6'],
      defaultModel: 'gpt-5.5',
      modelSelectionMode: 'userDefined3Tier',
      piAuthProvider: 'openai',
    })
  })

  it('preserves multiple U-API connections and user-selected default', () => {
    // Multi-connection soft lockdown: user adds u-api-2 alongside u-api-default,
    // sets u-api-2 as default. enforceUApiBaseUrl must keep both rows, force constraint
    // fields on each, and respect the user's defaultLlmConnection choice. (02 §6.2)
    const { configDir, workspaceRoot, configPath } = setupWorkspaceConfigDir()

    writeRootConfig(configPath, workspaceRoot, {
      defaultLlmConnection: 'u-api-2',
      llmConnections: [
        {
          slug: 'u-api-default',
          name: '主 Key',
          providerType: 'pi_compat',
          baseUrl: 'https://token.u-studio.cn/v1',
          authType: 'api_key_with_endpoint',
          customEndpoint: { api: 'anthropic-messages', supportsImages: true },
          models: ['claude-sonnet-4-6'],
          defaultModel: 'claude-sonnet-4-6',
          modelSelectionMode: 'userDefined3Tier',
          createdAt: Date.now(),
        },
        {
          slug: 'u-api-2',
          name: 'DeepSeek Key',
          providerType: 'pi',
          baseUrl: 'https://evil.example/v1',  // tampered — should be reset
          authType: 'api_key',
          customEndpoint: { api: 'openai-completions' },
          models: ['deepseek-chat'],
          defaultModel: 'deepseek-chat',
          modelSelectionMode: 'userDefined3Tier',
          createdAt: Date.now(),
        },
      ],
    })

    runMigration(configDir)

    const migrated = readConfigJson(configPath)
    expect(migrated.llmConnections).toHaveLength(2)
    expect(migrated.defaultLlmConnection).toBe('u-api-2')  // user choice preserved

    const primary = migrated.llmConnections.find((c: { slug: string }) => c.slug === 'u-api-default')
    const second = migrated.llmConnections.find((c: { slug: string }) => c.slug === 'u-api-2')

    expect(primary).toMatchObject({
      name: '主 Key',
      providerType: 'pi_compat',
      baseUrl: 'https://token.u-studio.cn/v1',
      authType: 'api_key_with_endpoint',
    })
    expect(second).toMatchObject({
      name: 'DeepSeek Key',
      providerType: 'pi_compat',  // force-reset from 'pi'
      baseUrl: 'https://token.u-studio.cn/v1',  // force-reset from 'evil.example'
      authType: 'api_key_with_endpoint',
      models: ['deepseek-chat'],
    })
  })

  it('is a continuous idempotent lock and not a one-shot migration marker', () => {
    const { configDir, workspaceRoot, configPath } = setupWorkspaceConfigDir()

    writeRootConfig(configPath, workspaceRoot, {
      defaultLlmConnection: 'u-api-default',
      llmConnections: [
        {
          slug: 'u-api-default',
          name: 'U-API',
          providerType: 'pi_compat',
          baseUrl: 'https://token.u-studio.cn/v1',
          authType: 'api_key_with_endpoint',
          customEndpoint: { api: 'anthropic-messages', supportsImages: true },
          models: ['gpt-5.5'],
          defaultModel: 'gpt-5.5',
          modelSelectionMode: 'userDefined3Tier',
          migrationsApplied: ['not-a-real-connection-field'],
          createdAt: Date.now(),
        },
      ],
      migrationsApplied: ['opus-4-6-restored'],
    })

    runMigration(configDir)
    const first = readConfigJson(configPath)

    first.defaultLlmConnection = 'pi-api-key'
    first.llmConnections[0].baseUrl = 'https://evil.example/v1'
    first.llmConnections.push({
      slug: 'pi-api-key',
      name: 'U-API (OpenAI)',
      providerType: 'pi',
      authType: 'api_key',
      piAuthProvider: 'openai',
      createdAt: Date.now(),
    })
    writeFileSync(configPath, JSON.stringify(first, null, 2), 'utf-8')

    runMigration(configDir)

    const second = readConfigJson(configPath)
    expect(second.defaultLlmConnection).toBe('u-api-default')
    expect(second.llmConnections).toHaveLength(1)
    expect(second.llmConnections[0].baseUrl).toBe('https://token.u-studio.cn/v1')
    expect(second.llmConnections[0].models).toEqual(['gpt-5.5'])
    expect(second.llmConnections[0].defaultModel).toBe('gpt-5.5')
  })

  it('exempts U-API connections from upstream deprecated-model normalization (D2, 02 §6.2.2)', () => {
    // claude-opus-4-6 here is a newapi route name. Upstream v0.10.1+
    // migrateLegacyOpusToDefaultOpus would rewrite it to claude-opus-4-8;
    // the U-API exemption must keep the user-managed list byte-identical.
    const { configDir, workspaceRoot, configPath } = setupWorkspaceConfigDir()

    writeRootConfig(configPath, workspaceRoot, {
      defaultLlmConnection: 'u-api-default',
      llmConnections: [
        {
          slug: 'u-api-default',
          name: 'U-API',
          providerType: 'pi_compat',
          baseUrl: 'https://token.u-studio.cn/v1',
          authType: 'api_key_with_endpoint',
          customEndpoint: { api: 'openai-completions', supportsImages: true },
          models: ['claude-opus-4-6', 'deepseek-v4-pro'],
          defaultModel: 'claude-opus-4-6',
          modelSelectionMode: 'userDefined3Tier',
          createdAt: Date.now(),
        },
      ],
    })

    runMigration(configDir)

    const migrated = readConfigJson(configPath)
    expect(migrated.llmConnections).toHaveLength(1)
    expect(migrated.llmConnections[0].models).toEqual(['claude-opus-4-6', 'deepseek-v4-pro'])
    expect(migrated.llmConnections[0].defaultModel).toBe('claude-opus-4-6')
  })
})
