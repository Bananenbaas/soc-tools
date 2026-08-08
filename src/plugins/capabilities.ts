import type { PluginManifest } from './types'

export type PluginCapability = 'wasm'
export type CspTokensByDirective = ReadonlyMap<string, ReadonlySet<string>>

export const capabilityCspRequirements = {
  wasm: { directive: 'script-src', token: "'wasm-unsafe-eval'" },
} as const satisfies Readonly<Record<PluginCapability, { directive: string; token: string }>>

export const knownCapabilities = new Set<string>(Object.keys(capabilityCspRequirements))
export const evalLikeCspTokens = new Set(["'unsafe-eval'", "'wasm-unsafe-eval'"])

export function requiredCapabilityCspTokensByDirective(plugins: readonly PluginManifest[]): CspTokensByDirective {
  const requirements = new Map<string, Set<string>>()
  for (const plugin of plugins) {
    for (const capability of plugin.capabilities ?? []) {
      if (!knownCapabilities.has(capability)) continue
      const requirement = capabilityCspRequirements[capability as PluginCapability]
      if (!requirement) continue
      const tokens = requirements.get(requirement.directive) ?? new Set<string>()
      tokens.add(requirement.token)
      requirements.set(requirement.directive, tokens)
    }
  }
  return requirements
}

export function requiredCapabilityCspTokens(plugins: readonly PluginManifest[]): ReadonlySet<string> {
  return new Set([...requiredCapabilityCspTokensByDirective(plugins)].flatMap(([, tokens]) => [...tokens]))
}

export function cspTokensByDirective(policy: string): CspTokensByDirective {
  const tokens = new Map<string, Set<string>>()
  for (const source of policy.split(';')) {
    const parts = source.trim().split(/\s+/u)
    const directive = parts.shift()
    if (!directive) continue
    const directiveTokens = tokens.get(directive) ?? new Set<string>()
    for (const token of parts) directiveTokens.add(token)
    tokens.set(directive, directiveTokens)
  }
  return tokens
}

export function shippedEvalLikeCspTokensByDirective(policy: string): CspTokensByDirective {
  return new Map([...cspTokensByDirective(policy)].map(([directive, tokens]) => [
    directive,
    new Set([...tokens].filter((token) => evalLikeCspTokens.has(token))),
  ]))
}

// Kept as a compatibility helper for callers that only need script-src.
export function shippedEvalLikeCspTokens(policy: string): ReadonlySet<string> {
  return shippedEvalLikeCspTokensByDirective(policy).get('script-src') ?? new Set()
}

export function assertCapabilityCspContract(policy: string, plugins: readonly PluginManifest[]): void {
  const required = requiredCapabilityCspTokensByDirective(plugins)
  const shipped = cspTokensByDirective(policy)
  for (const [directive, tokens] of required) {
    const actual = shipped.get(directive) ?? new Set<string>()
    for (const token of tokens) {
      if (!actual.has(token)) throw new Error(`CSP ${directive} is missing required token ${token}`)
    }
  }
  for (const [directive, tokens] of shippedEvalLikeCspTokensByDirective(policy)) {
    const allowed = required.get(directive) ?? new Set<string>()
    for (const token of tokens) {
      if (!allowed.has(token)) throw new Error(`CSP ${directive} contains unjustified token ${token}`)
    }
  }
}
