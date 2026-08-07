export interface SocToolsConfig {
  disabledTools?: readonly string[]
  enabledTools?: readonly string[]
}

export function readConfig(config: unknown): SocToolsConfig {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('soc-tools.config.ts must export an object')
  }
  const candidate = config as Record<string, unknown>
  const allowedKeys = new Set(['disabledTools', 'enabledTools'])
  for (const key of Object.keys(candidate)) {
    if (!allowedKeys.has(key)) throw new Error(`Unknown SOC-Tools config option: ${key}`)
  }
  for (const key of allowedKeys) {
    const value = Object.prototype.hasOwnProperty.call(candidate, key) ? candidate[key] : undefined
    if (value !== undefined && (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))) {
      throw new Error(`${key} must be an array of tool ids`)
    }
  }
  return {
    ...(Object.prototype.hasOwnProperty.call(candidate, 'disabledTools') && candidate.disabledTools !== undefined ? { disabledTools: candidate.disabledTools as string[] } : {}),
    ...(Object.prototype.hasOwnProperty.call(candidate, 'enabledTools') && candidate.enabledTools !== undefined ? { enabledTools: candidate.enabledTools as string[] } : {}),
  }
}

export function validateConfig(config: unknown): asserts config is SocToolsConfig {
  readConfig(config)
}
