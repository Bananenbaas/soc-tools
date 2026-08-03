import type { ThemeDefinition } from '../themes/types'
import type { ToolDefinition } from '../tools/types'

export const PLUGIN_API_VERSION = 1

export interface PluginManifest {
  id: string
  name: string
  version: string
  license: string
  pluginApiVersion: number
  minCoreVersion: string
  maxCoreVersion?: string
  provides: {
    tools?: readonly ToolDefinition[]
    themes?: readonly ThemeDefinition[]
  }
  messages: {
    en: Record<string, unknown>
    nl: Record<string, unknown>
  }
  capabilities?: readonly 'wasm'[]
}

export function definePlugin<const T extends PluginManifest>(manifest: T): T {
  return manifest
}
