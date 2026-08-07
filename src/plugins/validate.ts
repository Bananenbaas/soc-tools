import type { PluginManifest } from './types'
import { PLUGIN_API_VERSION } from './types'
import { createMessageTree, mergeMessageTrees } from './merge'
import { themeTokenNames, type ThemeDefinition } from '../themes/types'
import { knownCapabilities } from './capabilities'

const TOOL_ID = /^[a-z0-9-]+\.[a-z0-9-]+$/u
const PLUGIN_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u
const THEME_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u
const TOOL_ROUTE = /^\/tools\/[a-z0-9-]+$/u
const RESERVED_ROUTES = new Set(['/', '/licenses'])
const RESERVED_MESSAGE_NAMESPACES = new Set(['app', 'home', 'licenses', 'common'])
const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u

function versionParts(version: string): readonly number[] | undefined {
  const match = SEMVER.exec(version)
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined
}

function compareVersions(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < 3; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

export function hasPath(value: Record<string, unknown>, path: string): boolean {
  let current: unknown = value
  for (const segment of path.split('.')) {
    if (!current || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, segment)) return false
    current = (current as Record<string, unknown>)[segment]
  }
  return typeof current === 'string' && current.length > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function validateTheme(theme: unknown, prefix: string, violations: string[]): theme is ThemeDefinition {
  if (!isRecord(theme)) { violations.push(`${prefix}: theme must be an object`); return false }
  if (typeof theme.id !== 'string' || !THEME_ID.test(theme.id)) violations.push(`${prefix}: theme id must match ${THEME_ID.source}`)
  if (typeof theme.nameKey !== 'string' || !theme.nameKey) violations.push(`${prefix}: theme nameKey must be a non-empty string`)
  const tokens = theme.tokens
  if (!isRecord(tokens)) { violations.push(`${prefix}: theme tokens must be an object`); return false }
  for (const mode of ['dark', 'light'] as const) {
    const modeTokens = tokens[mode]
    if (!isRecord(modeTokens)) { violations.push(`${prefix}: theme tokens.${mode} must be an object`); continue }
    for (const name of themeTokenNames) {
      const token = modeTokens[name]
      if (typeof token !== 'string' || !/^#[0-9A-Fa-f]{3,8}$/u.test(token)) violations.push(`${prefix}: theme token ${mode}.${name} must be a hex color`)
    }
  }
  return true
}

export function guardUniqueTools(plugins: readonly PluginManifest[]): void {
  const ids = new Set<string>()
  const routes = new Set<string>()
  for (const plugin of plugins) {
    for (const tool of plugin.provides.tools ?? []) {
      if (ids.has(tool.id)) throw new Error(`Duplicate tool id: ${tool.id}`)
      if (routes.has(tool.routePath)) throw new Error(`Duplicate tool route: ${tool.routePath}`)
      ids.add(tool.id)
      routes.add(tool.routePath)
    }
  }
}

export function validatePlugins(plugins: readonly PluginManifest[], coreVersion: string): string[] {
  const violations: string[] = []
  const core = versionParts(coreVersion)
  const mergedMessages = { en: createMessageTree(), nl: createMessageTree() }
  const seenPluginIds = new Set<string>()
  const seenToolIds = new Set<string>()
  const seenRoutes = new Set<string>()
  const seenThemeIds = new Set<string>()
  const seenMessageLeaves = { en: new Set<string>(), nl: new Set<string>() }

  for (const plugin of plugins) {
    const prefix = `Plugin ${isRecord(plugin) && typeof plugin.id === 'string' ? plugin.id : '<unknown>'}`
    if (!isRecord(plugin)) { violations.push(`${prefix}: manifest must be an object`); continue }
    if (typeof plugin.name !== 'string' || !plugin.name.trim()) violations.push(`${prefix}: name must be non-empty`)
    if (typeof plugin.id !== 'string' || !PLUGIN_ID.test(plugin.id)) violations.push(`${prefix}: id must match ${PLUGIN_ID.source}`)
    if (typeof plugin.capabilities !== 'undefined' && (!Array.isArray(plugin.capabilities) || plugin.capabilities.some((capability) => typeof capability !== 'string' || !knownCapabilities.has(capability)))) violations.push(`${prefix}: capabilities must contain only known capabilities`)
    if (!isRecord(plugin.provides)) { violations.push(`${prefix}: provides must be an object`); continue }
    for (const member of ['tools', 'themes'] as const) {
      if (Object.prototype.hasOwnProperty.call(plugin.provides, member) && !Array.isArray(plugin.provides[member])) violations.push(`${prefix}: provides.${member} must be an array`)
    }
    if (!isRecord(plugin.messages) || !isRecord(plugin.messages.en) || !isRecord(plugin.messages.nl)) {
      violations.push(`${prefix}: messages.en and messages.nl must be objects`)
      continue
    }
    const enViolations = mergeMessageTrees(createMessageTree(), plugin.messages.en, `${prefix}.messages.en`)
    const nlViolations = mergeMessageTrees(createMessageTree(), plugin.messages.nl, `${prefix}.messages.nl`)
    violations.push(...enViolations, ...nlViolations)
    for (const locale of ['en', 'nl'] as const) {
      const source = plugin.messages[locale]
      const leaves: string[] = []
      const collect = (value: Record<string, unknown>, path = ''): void => {
        for (const key of Object.keys(value)) {
          const nextPath = path ? `${path}.${key}` : key
          const child = value[key]
          if (child && typeof child === 'object' && !Array.isArray(child)) collect(child as Record<string, unknown>, nextPath)
          else leaves.push(nextPath)
        }
      }
      collect(source)
      for (const leaf of leaves) {
        const namespace = leaf.split('.')[0]
        if (RESERVED_MESSAGE_NAMESPACES.has(namespace)) violations.push(`${prefix}: message key ${leaf} is reserved for the core shell`)
        if (seenMessageLeaves[locale].has(leaf)) violations.push(`${prefix}: message key ${leaf} collides with another plugin`)
      }
      if ((locale === 'en' ? enViolations : nlViolations).length === 0) {
        mergeMessageTrees(mergedMessages[locale], source)
        for (const leaf of leaves) seenMessageLeaves[locale].add(leaf)
      }
    }
  }

  for (const plugin of plugins) {
    if (!isRecord(plugin)) continue
    const prefix = `Plugin ${typeof plugin.id === 'string' ? plugin.id : '<unknown>'}`
    if (typeof plugin.id !== 'string' || !PLUGIN_ID.test(plugin.id)) { /* reported above */ }
    else if (seenPluginIds.has(plugin.id)) violations.push(`Duplicate plugin id: ${plugin.id}`)
    else seenPluginIds.add(plugin.id)
    if (typeof plugin.license !== 'string' || !plugin.license.trim()) violations.push(`${prefix}: license must be non-empty`)
    if (typeof plugin.version !== 'string' || !versionParts(plugin.version)) violations.push(`${prefix}: version is not valid semver`)
    if (plugin.pluginApiVersion !== PLUGIN_API_VERSION) violations.push(`${prefix}: incompatible plugin API version ${plugin.pluginApiVersion}`)
    const minimum = typeof plugin.minCoreVersion === 'string' ? versionParts(plugin.minCoreVersion) : undefined
    const maximum = typeof plugin.maxCoreVersion === 'string' ? versionParts(plugin.maxCoreVersion) : undefined
    if (!core) violations.push(`Core version is not valid semver: ${coreVersion}`)
    if (!minimum) violations.push(`${prefix}: minCoreVersion is not valid semver`)
    if (plugin.maxCoreVersion !== undefined && !maximum) violations.push(`${prefix}: maxCoreVersion is not valid semver`)
    if (core && minimum && compareVersions(core, minimum) < 0) violations.push(`${prefix}: requires core >= ${String(plugin.minCoreVersion)}`)
    if (core && maximum && compareVersions(core, maximum) > 0) violations.push(`${prefix}: requires core <= ${String(plugin.maxCoreVersion)}`)
    if (minimum && maximum && compareVersions(minimum, maximum) > 0) violations.push(`${prefix}: core version range is unsatisfiable`)
    if (!isRecord(plugin.provides)) continue
    const tools = Array.isArray(plugin.provides.tools) ? plugin.provides.tools : []
    for (const tool of tools) {
      if (!isRecord(tool)) { violations.push(`${prefix}: tool must be an object`); continue }
      const toolId = typeof tool.id === 'string' ? tool.id : '<unknown>'
      if (seenToolIds.has(toolId)) violations.push(`Duplicate tool id: ${toolId}`)
      const route = typeof tool.routePath === 'string' ? tool.routePath : '<unknown>'
      if (seenRoutes.has(route)) violations.push(`Duplicate tool route: ${route}`)
      seenToolIds.add(toolId); seenRoutes.add(route)
      if (!TOOL_ID.test(toolId)) violations.push(`${toolId}: id must match ${TOOL_ID.source}`)
      if (typeof tool.nameKey !== 'string' || !tool.nameKey) violations.push(`${toolId}: nameKey must be a non-empty string`)
      if (typeof tool.descriptionKey !== 'string' || !tool.descriptionKey) violations.push(`${toolId}: descriptionKey must be a non-empty string`)
      if (typeof tool.category !== 'string' || !tool.category) violations.push(`${toolId}: category must be a non-empty string`)
      if (typeof tool.routePath !== 'string' || !TOOL_ROUTE.test(tool.routePath)) violations.push(`${toolId}: routePath must match ${TOOL_ROUTE.source}`)
      if (typeof tool.routePath === 'string' && RESERVED_ROUTES.has(tool.routePath)) violations.push(`${toolId}: routePath is reserved`)
      if (typeof tool.component !== 'function') violations.push(`${toolId}: component must be a function`)
      if (typeof tool.recommendedMaxInputBytes !== 'number' || !Number.isFinite(tool.recommendedMaxInputBytes) || tool.recommendedMaxInputBytes <= 0) violations.push(`${toolId}: recommendedMaxInputBytes must be a positive number`)
      for (const locale of ['en', 'nl'] as const) {
        if (typeof tool.category === 'string' && !hasPath(mergedMessages[locale], `categories.${tool.category}`)) violations.push(`${toolId}: missing ${locale} category message`)
        if (typeof tool.nameKey === 'string' && !hasPath(mergedMessages[locale], tool.nameKey)) violations.push(`${tool.id}: missing ${locale} tool nameKey ${tool.nameKey}`)
        if (typeof tool.descriptionKey === 'string' && !hasPath(mergedMessages[locale], tool.descriptionKey)) violations.push(`${tool.id}: missing ${locale} tool descriptionKey ${tool.descriptionKey}`)
      }
      if (tool.icon !== undefined) {
        if (!isRecord(tool.icon) || typeof tool.icon.viewBox !== 'string' || !Array.isArray(tool.icon.paths) || !tool.icon.viewBox.trim() || tool.icon.paths.length === 0 || tool.icon.paths.some((path) => typeof path !== 'string' || !path.trim())) violations.push(`${toolId}: icon requires a viewBox and non-empty paths`)
      }
    }
    const themes = Array.isArray(plugin.provides.themes) ? plugin.provides.themes : []
    themes.forEach((theme, index) => {
      if (validateTheme(theme, `${prefix}: provides.themes[${index}]`, violations)) {
        if (seenThemeIds.has(theme.id)) violations.push(`${prefix}: duplicate theme id ${theme.id}`)
        seenThemeIds.add(theme.id)
        for (const locale of ['en', 'nl'] as const) {
          if (!hasPath(mergedMessages[locale], theme.nameKey)) violations.push(`${prefix}: theme ${theme.id} missing ${locale} nameKey ${theme.nameKey}`)
        }
      }
    })
  }
  return violations
}
