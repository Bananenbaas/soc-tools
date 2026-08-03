import { describe, expect, it } from 'vitest'
import packageJson from '../../package.json'
import { discoveredPlugins } from '.'
import { hasPath, validatePlugins } from './validate'

describe('discovered plugins', () => {
  it('satisfy the plugin contract', () => {
    expect(validatePlugins(discoveredPlugins, packageJson.version)).toEqual([])
  })

  it('discover all 22 core tools', () => {
    expect(discoveredPlugins.flatMap((plugin) => plugin.provides.tools ?? [])).toHaveLength(22)
  })

  it('rejects a malformed plugin before runtime registries can be built', () => {
    const malformed = { ...discoveredPlugins[0], id: 'bad plugin', provides: undefined }
    const violations = validatePlugins([malformed] as never, packageJson.version)
    expect(violations).toContain('Plugin bad plugin: provides must be an object')
  })

  it('rejects forbidden message keys and never mutates Object.prototype', () => {
    const messages = JSON.parse('{"__proto__":{"polluted":"yes"},"constructor":{"prototype":{"polluted":"yes"}}}') as Record<string, unknown>
    const plugin = { ...discoveredPlugins[0], messages: { en: messages, nl: {} } }
    const violations = validatePlugins([plugin] as never, packageJson.version)
    expect(violations.some((violation) => violation.includes('Forbidden message key'))).toBe(true)
    expect(Object.prototype).not.toHaveProperty('polluted')
  })

  it('does not treat inherited translation keys as present', () => {
    const inherited = Object.create({ categories: { inherited: 'wrong' } }) as Record<string, unknown>
    expect(hasPath(inherited, 'categories.inherited')).toBe(false)
  })
})
