import { describe, expect, it } from 'vitest'
import { decodeUrl, encodeUrl } from './url'

describe('URL encoding', () => {
  it.each([['hello world', 'hello%20world'], ['a/b?c=d', 'a%2Fb%3Fc%3Dd'], ['✓', '%E2%9C%93']])('encodes components', (plain, encoded) => {
    expect(encodeUrl(plain)).toBe(encoded)
    expect(decodeUrl(encoded)).toBe(plain)
  })
  it('preserves URL structure in full-URL mode', () => {
    expect(encodeUrl('https://example.com/a path?q=hello world', 'full')).toBe('https://example.com/a%20path?q=hello%20world')
    expect(decodeUrl('https://example.com/a%20path?q=hello%20world', 'full')).toBe('https://example.com/a path?q=hello world')
  })
  it('rejects malformed percent escapes and invalid full URLs', () => {
    expect(() => decodeUrl('%E0%A4%A')).toThrow()
    expect(() => encodeUrl('not a URL', 'full')).toThrow()
  })
  it('round-trips components', () => {
    for (let index = 0; index < 300; index += 1) {
      const value = `IOC ${index}/✓?x=${String.fromCodePoint(0x1f300 + index)}`
      expect(decodeUrl(encodeUrl(value))).toBe(value)
    }
  })
})
