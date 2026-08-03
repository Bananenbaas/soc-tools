export interface SocToolsConfig {
  disabledTools?: readonly string[]
  enabledTools?: readonly string[]
}

export function validateConfig(config: unknown): asserts config is SocToolsConfig {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('soc-tools.config.ts must export an object')
  }
  const candidate = config as Record<string, unknown>
  const allowedKeys = new Set(['disabledTools', 'enabledTools'])
  for (const key of Object.keys(candidate)) {
    if (!allowedKeys.has(key)) throw new Error(`Unknown SOC-Tools config option: ${key}`)
  }
  for (const key of allowedKeys) {
    const value = candidate[key]
    if (value !== undefined && (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))) {
      throw new Error(`${key} must be an array of tool ids`)
    }
  }
}
