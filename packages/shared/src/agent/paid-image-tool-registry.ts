// U-API: paid image callback 按 canonical session path + owner 隔离，旧agent不能删新callback（16B §5）。
import { resolve } from 'node:path'
import type { GenerateImageToolInput, ToolResult } from '@u-agents/session-tools-core'

export type PaidImageToolCallback = (input: GenerateImageToolInput) => Promise<ToolResult>

interface PaidImageToolEntry {
  ownerToken: string
  callback: PaidImageToolCallback
}

const registry = new Map<string, PaidImageToolEntry>()

function key(sessionPath: string): string {
  return resolve(sessionPath)
}

export function registerPaidImageToolCallback(
  sessionPath: string,
  ownerToken: string,
  callback: PaidImageToolCallback,
): void {
  registry.set(key(sessionPath), { ownerToken, callback })
}

export function unregisterPaidImageToolCallback(sessionPath: string, ownerToken: string): boolean {
  const canonical = key(sessionPath)
  const current = registry.get(canonical)
  if (!current || current.ownerToken !== ownerToken) return false
  registry.delete(canonical)
  return true
}

export async function executePaidImageToolCallback(
  sessionPath: string,
  ownerToken: string,
  input: GenerateImageToolInput,
): Promise<ToolResult | null> {
  const current = registry.get(key(sessionPath))
  if (!current || current.ownerToken !== ownerToken) return null
  return current.callback(input)
}

export function clearPaidImageToolRegistryForTests(): void {
  registry.clear()
}
