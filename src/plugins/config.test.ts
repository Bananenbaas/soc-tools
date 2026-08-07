import { describe, expect, it } from 'vitest'
import { readConfig } from './config'

describe('plugin configuration ownership', () => {
  it('ignores inherited tool filters', () => {
    const inherited = Object.create({ disabledTools: ['soc-tools.base64'] }) as Record<string, unknown>
    expect(readConfig(inherited)).toEqual({})
  })

  it('rejects non-array tool filters', () => {
    expect(() => readConfig({ disabledTools: 'soc-tools.base64' })).toThrow('disabledTools must be an array')
  })
})
