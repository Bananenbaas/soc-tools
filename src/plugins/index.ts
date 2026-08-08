import type { ThemeDefinition } from '../themes/types'
import type { ToolDefinition } from '../tools/types'
import { readConfig, type SocToolsConfig } from './config'
import type { PluginManifest } from './types'
import { createMessageTree, mergeMessageTrees } from './merge'
import { guardUniqueTools, validatePlugins } from './validate'
import { requiredCapabilityCspTokens } from './capabilities'

type PluginModule = { default: PluginManifest }
const modules = import.meta.glob<PluginModule>('./*/plugin.ts', { eager: true })
const configModule = Object.values(import.meta.glob<{ default: unknown }>('../../soc-tools.config.ts', { eager: true }))[0]
const config = configModule?.default ?? {}

export const discoveredPlugins = Object.entries(modules)
  .sort(([left], [right]) => {
    if (left === './core/plugin.ts') return -1
    if (right === './core/plugin.ts') return 1
    return left.localeCompare(right)
  })
  .map(([path, module]) => {
    try {
      if (!module || typeof module.default !== 'object' || module.default === null) throw new Error('default export is not a manifest object')
      return module.default
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause)
      throw new Error(`Failed to initialize plugin module ${path}: ${detail}`, { cause })
    }
  })

const pluginViolations = validatePlugins(discoveredPlugins, __APP_VERSION__)
if (pluginViolations.length > 0) throw new Error(`Invalid plugin configuration:\n${pluginViolations.map((violation) => `- ${violation}`).join('\n')}`)
guardUniqueTools(discoveredPlugins)
const pluginConfig: SocToolsConfig = readConfig(config)

const allTools = discoveredPlugins.flatMap((plugin) => plugin.provides.tools ?? [])
const knownToolIds = new Set(allTools.map((tool) => tool.id))
const configuredIds = [...(pluginConfig.disabledTools ?? []), ...(pluginConfig.enabledTools ?? [])]
for (const id of configuredIds) {
  if (!knownToolIds.has(id as ToolDefinition['id'])) throw new Error(`Unknown tool id in soc-tools.config.ts: ${id}`)
}

const disabledTools = new Set(pluginConfig.disabledTools ?? [])
const enabledTools = pluginConfig.enabledTools ? new Set(pluginConfig.enabledTools) : undefined

export function pluginIsActive(
  plugin: PluginManifest,
  disabledTools: ReadonlySet<string> = new Set(),
  enabledTools?: ReadonlySet<string>,
): boolean {
  const tools = plugin.provides.tools ?? []
  const hasEnabledTool = tools.some((tool) => !disabledTools.has(tool.id) && (!enabledTools || enabledTools.has(tool.id)))
  return hasEnabledTool || (plugin.provides.themes?.length ?? 0) > 0
}

export const enabledPlugins = discoveredPlugins.filter((plugin) => pluginIsActive(plugin, disabledTools, enabledTools))
export const requiredPluginCapabilityCspTokens = requiredCapabilityCspTokens(enabledPlugins)

export const toolRegistry: readonly ToolDefinition[] = allTools.filter((tool) =>
  !disabledTools.has(tool.id) && (!enabledTools || enabledTools.has(tool.id)),
)

export const themeRegistry: readonly ThemeDefinition[] = enabledPlugins.flatMap((plugin) => plugin.provides.themes ?? [])

const mergedPluginMessages = { en: createMessageTree(), nl: createMessageTree() }
for (const plugin of enabledPlugins) {
  mergeMessageTrees(mergedPluginMessages.en, plugin.messages.en)
  mergeMessageTrees(mergedPluginMessages.nl, plugin.messages.nl)
}

export const pluginMessages = mergedPluginMessages

export const pluginLicenses = enabledPlugins.map((plugin) => ({
  name: plugin.name,
  version: plugin.version,
  license: plugin.license,
}))
