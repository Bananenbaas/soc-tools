import { describe, expect, it } from 'vitest'
import { decodeBase64, encodeBase64 } from './base64'

describe('Base64', () => {
  it.each([
    ['', ''],
    ['f', 'Zg=='],
    ['fo', 'Zm8='],
    ['foo', 'Zm9v'],
    ['foobar', 'Zm9vYmFy'],
    ['✓ à la mode', '4pyTIMOgIGxhIG1vZGU='],
  ])('encodes known vector %j', (plain, encoded) => {
    expect(encodeBase64(plain)).toBe(encoded)
    expect(decodeBase64(encoded)).toBe(plain)
  })

  it('uses the URL-safe alphabet without padding', () => {
    expect(encodeBase64('ÿÿ', 'base64url')).toBe('w7_Dvw')
    expect(decodeBase64('w7_Dvw', 'base64url')).toBe('ÿÿ')
  })

  it('rejects invalid input', () => {
    expect(() => decodeBase64('%%%')).toThrow()
    expect(() => decodeBase64('/w==')).toThrow()
  })

  it('round-trips deterministic Unicode strings', () => {
    let seed = 0x51f15e
    const next = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed
    }
    for (let sample = 0; sample < 500; sample += 1) {
      const length = next() % 80
      let value = ''
      for (let index = 0; index < length; index += 1) {
        let codePoint = next() % 0x110000
        if (codePoint >= 0xd800 && codePoint <= 0xdfff) codePoint = 0x20
        value += String.fromCodePoint(codePoint)
      }
      expect(decodeBase64(encodeBase64(value))).toBe(value)
      expect(decodeBase64(encodeBase64(value, 'base64url'), 'base64url')).toBe(value)
    }
  })
})
