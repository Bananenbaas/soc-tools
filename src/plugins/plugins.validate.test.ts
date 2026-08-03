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

  it('rejects each invalid manifest shape enforced by the validator', () => {
    const base = discoveredPlugins[0]
    const missingLicense = { ...base }
    delete (missingLicense as { license?: string }).license
    const cases: Array<[string, unknown, string]> = [
      ['empty license', { ...base, license: '  ' }, 'license must be non-empty'],
      ['missing license', missingLicense, 'license must be non-empty'],
      ['incompatible API', { ...base, pluginApiVersion: 999 }, 'incompatible plugin API version'],
      ['core too old', { ...base, minCoreVersion: '99.0.0' }, 'requires core >= 99.0.0'],
      ['malformed tool id', { ...base, provides: { ...base.provides, tools: [{ ...base.provides.tools?.[0], id: 'not-valid' }] } }, 'id must match'],
      ['duplicate tool id', { ...base, provides: { ...base.provides, tools: [base.provides.tools?.[0], base.provides.tools?.[0]] } }, 'Duplicate tool id'],
      ['malformed route', { ...base, provides: { ...base.provides, tools: [{ ...base.provides.tools?.[0], routePath: 'tools/no-leading-slash' }] } }, 'routePath must start with /'],
      ['missing English tool message', { ...base, provides: { ...base.provides, tools: [{ ...base.provides.tools?.[0], id: 'fixture.missing-en' }] }, messages: { en: {}, nl: base.messages.nl } }, 'missing en tool name'],
      ['missing Dutch tool message', { ...base, provides: { ...base.provides, tools: [{ ...base.provides.tools?.[0], id: 'fixture.missing-nl' }] }, messages: { en: base.messages.en, nl: {} } }, 'missing nl tool name'],
      ['invalid icon', { ...base, provides: { ...base.provides, tools: [{ ...base.provides.tools?.[0], icon: { viewBox: '', paths: [] } }] } }, 'icon requires a viewBox'],
      ['forbidden message key', { ...base, messages: { en: JSON.parse('{"__proto__":{"polluted":"yes"}}'), nl: base.messages.nl } }, 'Forbidden message key'],
    ]

    for (const [name, manifest, expected] of cases) {
      expect(validatePlugins([manifest] as never, packageJson.version), name).toEqual(expect.arrayContaining([expect.stringContaining(expected)]))
    }
  })

  it('accepts a fully valid plugin manifest', () => {
    const valid = {
      id: 'fixture.valid', name: 'Fixture Valid', version: '1.0.0', license: 'MIT',
      pluginApiVersion: 1, minCoreVersion: '1.0.0', provides: { tools: [], themes: [] },
      messages: { en: {}, nl: {} }, capabilities: ['wasm'] as const,
    }
    expect(validatePlugins([valid], packageJson.version)).toEqual([])
  })
})
