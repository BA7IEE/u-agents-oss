import { execFile } from 'node:child_process'
import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { PlatformServices } from '../runtime/platform'

const execFileAsync = promisify(execFile)

type DocumentToolPlatform = Pick<PlatformServices, 'appRootPath' | 'resourcesPath' | 'isPackaged'>

export interface MarkitdownRuntime {
  uvPath: string
  scriptPath: string
}

export function resolveMarkitdownRuntime(
  platform: DocumentToolPlatform,
  env: NodeJS.ProcessEnv = process.env,
): MarkitdownRuntime {
  const scriptsDir = env.CRAFT_SCRIPTS
    ?? (env.U_AGENTS_RESOURCES_BASE
      ? join(env.U_AGENTS_RESOURCES_BASE, 'resources', 'scripts')
      : platform.isPackaged
        ? join(platform.resourcesPath, 'app', 'resources', 'scripts')
        : join(platform.appRootPath, 'apps', 'electron', 'resources', 'scripts'))

  return {
    uvPath: env.U_AGENTS_UV || 'uv',
    scriptPath: join(scriptsDir, 'markitdown_cli.py'),
  }
}

function conversionErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  if ('stderr' in error && typeof error.stderr === 'string' && error.stderr.trim()) {
    return error.stderr.trim()
  }
  return error.message
}

export async function convertDocumentToMarkdown(
  inputPath: string,
  outputPath: string,
  platform: DocumentToolPlatform,
): Promise<void> {
  const runtime = resolveMarkitdownRuntime(platform)
  await access(runtime.scriptPath)

  try {
    await execFileAsync(
      runtime.uvPath,
      [
        'run',
        '--python',
        '3.12',
        runtime.scriptPath,
        '--output',
        outputPath,
        inputPath,
      ],
      {
        encoding: 'utf-8',
        timeout: 300_000,
        maxBuffer: 2 * 1024 * 1024,
      },
    )

    const markdown = await readFile(outputPath, 'utf-8')
    if (!markdown.trim()) {
      throw new Error('Conversion returned empty result')
    }
  } catch (error) {
    throw new Error(conversionErrorMessage(error))
  }
}
