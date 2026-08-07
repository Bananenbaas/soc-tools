import type { PluginManifest } from './types'

export type PluginCapability = 'wasm'

export const capabilityCspRequirements = {
  wasm: { directive: 'script-src', token: "'wasm-unsafe-eval'" },
} as const satisfies Readonly<Record<PluginCapability, { directive: string; token: string }>>

export const knownCapabilities = new Set<string>(Object.keys(capabilityCspRequirements))

export const evalLikeCspTokens = new Set(["'unsafe-eval'", "'wasm-unsafe-eval'"])

export function requiredCapabilityCspTokens(plugins: readonly PluginManifest[]): ReadonlySet<string> {
  return new Set(plugins.flatMap((plugin) => (plugin.capabilities ?? []).flatMap((capability) => {
    const requirement = capabilityCspRequirements[capability as PluginCapability]
    return requirement ? [requirement.token] : []
  })))
}

export function shippedEvalLikeCspTokens(policy: string): ReadonlySet<string> {
  const scriptSource = policy.match(/(?:^|;)\s*script-src\s+([^;]+)/u)?.[1] ?? ''
  return new Set(scriptSource.split(/\s+/u).filter((token) => evalLikeCspTokens.has(token)))
}
