import { describe, expect, it } from 'vitest'
import { decodePunycodeHostname, decodePunycodeLabel, inspectUnicode } from './unicodeinspect'

describe('Unicode inspector', () => {
  it('reports code points and mixed Latin/Cyrillic runs and confusables', () => {
    const result = inspectUnicode('pаypal')
    expect(result.characters.map((item) => item.codePoint)).toEqual(['U+0070', 'U+0430', 'U+0079', 'U+0070', 'U+0061', 'U+006C'])
    expect(result.mixedScript).toBe(true)
    expect(result.scripts).toEqual(['Latin', 'Cyrillic'])
    expect(result.mixedScriptRuns).toEqual([
      { script: 'Latin', start: 1, end: 1 }, { script: 'Cyrillic', start: 2, end: 2 }, { script: 'Latin', start: 3, end: 6 },
    ])
    expect(result.confusables).toContainEqual({ position: 2, character: 'а', codePoint: 'U+0430', resembles: 'a', resemblesCodePoint: 'U+0061' })
  })

  it('finds zero-width and bidi controls at code-point positions', () => {
    const findings = inspectUnicode(`a\u200bb\u202ec`).invisibles
    expect(findings.map(({ position, codePoint, kind }) => ({ position, codePoint, kind }))).toEqual([
      { position: 2, codePoint: 'U+200B', kind: 'zero-width' },
      { position: 4, codePoint: 'U+202E', kind: 'bidi-control' },
    ])
  })

  it('reports compatibility normalization changes', () => {
    const normalization = inspectUnicode('Ａﬃ').normalization
    expect(normalization.nfkc).toBe('Affi')
    expect(normalization.nfkcChanged).toBe(true)
  })

  it('decodes RFC 3492 labels and hostnames', () => {
    expect(decodePunycodeLabel('xn--80ak6aa92e')).toBe('аррӏе')
    expect(decodePunycodeLabel('bcher-kva')).toBe('bücher')
    expect(decodePunycodeHostname('www.xn--bcher-kva.example')).toBe('www.bücher.example')
  })

  it('decodes each ladder format independently', () => {
    const escaped = inspectUnicode('x\\u0061\\u{1F600}\\x21').decodes.find((item) => item.kind === 'escapes')
    const percent = inspectUnicode('%E2%9C%93').decodes.find((item) => item.kind === 'percent')
    const html = inspectUnicode('&#x61;&#98;&amp;').decodes.find((item) => item.kind === 'html')
    expect(escaped).toMatchObject({ value: 'xa😀!', changed: true })
    expect(percent).toMatchObject({ value: '✓', changed: true })
    expect(html).toMatchObject({ value: 'ab&', changed: true })
  })
})
