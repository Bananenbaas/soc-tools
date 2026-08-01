import { describe, expect, it } from 'vitest'
import { analyzeEntropy, byteStats, decodeEntropyInput, shannonEntropy, slidingWindowEntropy } from './entropy'

describe('entropy analysis', () => {
  it('returns zero entropy for identical bytes', () => {
    expect(shannonEntropy(new Uint8Array(128).fill(0x41))).toBe(0)
  })

  it('returns eight bits for one occurrence of every byte', () => {
    const uniform = Uint8Array.from({ length: 256 }, (_, index) => index)
    expect(shannonEntropy(uniform)).toBeCloseTo(8, 12)
    expect(analyzeEntropy(uniform).normalizedEntropy).toBeCloseTo(1, 12)
  })

  it('matches the independently calculated entropy of a known string', () => {
    const bytes = new TextEncoder().encode('banana')
    const expected = -(3 / 6) * Math.log2(3 / 6) - (2 / 6) * Math.log2(2 / 6) - (1 / 6) * Math.log2(1 / 6)
    expect(shannonEntropy(bytes)).toBeCloseTo(expected, 12)
  })

  it('decodes equivalent hex and Base64 to identical byte statistics', () => {
    const fromHex = decodeEntropyInput('00 41 42 ff', 'hex')
    const fromBase64 = decodeEntropyInput('AEFC/w==', 'base64')
    expect(fromHex).toEqual(fromBase64)
    expect(byteStats(fromHex)).toEqual(byteStats(fromBase64))
    expect(byteStats(fromHex)).toMatchObject({ length: 4, printableAsciiCount: 2, nonPrintableCount: 2, uniqueByteCount: 4, nullByteCount: 1 })
  })

  it('creates a final partial chunk', () => {
    const chunks = slidingWindowEntropy(new Uint8Array(600), 256)
    expect(chunks).toHaveLength(3)
    expect(chunks.map((chunk) => chunk.offset)).toEqual([0, 256, 512])
  })
})
