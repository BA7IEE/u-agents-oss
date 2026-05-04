import { describe, expect, it } from 'bun:test'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { pathToFileURL } from 'url'

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

function writeRootConfig(configPath: string, workspaceRoot: string, config: Record<string, unknown>) {
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
        ...config,
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
})
