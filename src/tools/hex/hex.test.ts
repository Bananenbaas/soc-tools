import { describe, expect, it } from 'vitest'
import { decodeHex, encodeHex } from './hex'

describe('Hex', () => {
  it.each([['', ''], ['hello', '68656c6c6f'], ['✓', 'e29c93'], ['😀', 'f09f9880']])('encodes %j', (plain, encoded) => {
    expect(encodeHex(plain)).toBe(encoded)
    expect(decodeHex(encoded)).toBe(plain)
  })
  it('formats delimiters and case', () => {
    expect(encodeHex('AB', true, '0x')).toBe('0x41 0x42')
    expect(decodeHex('\\x41 \\x42')).toBe('AB')
  })
  it('rejects odd, non-hex, and invalid UTF-8 input', () => {
    expect(() => decodeHex('abc')).toThrow('Odd-length')
    expect(() => decodeHex('zz')).toThrow('Invalid hex')
    expect(() => decodeHex('ff')).toThrow('Invalid UTF-8')
  })
  it('round-trips deterministic Unicode strings', () => {
    for (let index = 0; index < 300; index += 1) {
      const value = `sample ${index} ✓ ${String.fromCodePoint(0x1f300 + index)}`
      expect(decodeHex(encodeHex(value))).toBe(value)
    }
  })
})
