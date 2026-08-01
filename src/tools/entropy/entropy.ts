import { decodeBase64Bytes } from '../base64/base64'
import { decodeHexBytes } from '../hex/hex'

export type EntropyInputMode = 'text' | 'hex' | 'base64'

export interface EntropyChunk {
  offset: number
  entropy: number
}

export interface ByteFrequency {
  byte: number
  count: number
}

export interface ByteStats {
  length: number
  printableAsciiCount: number
  nonPrintableCount: number
  mostCommonBytes: ByteFrequency[]
  leastCommonBytes: ByteFrequency[]
  uniqueByteCount: number
  nullByteCount: number
}

export interface EntropyAnalysis {
  entropy: number
  normalizedEntropy: number
  chunks: EntropyChunk[]
  stats: ByteStats
}

export function decodeEntropyInput(value: string, mode: EntropyInputMode): Uint8Array {
  if (mode === 'hex') return decodeHexBytes(value)
  if (mode === 'base64') return decodeBase64Bytes(value)
  return new TextEncoder().encode(value)
}

export function shannonEntropy(bytes: Uint8Array): number {
  if (bytes.length === 0) return 0
  const counts = new Uint32Array(256)
  for (const byte of bytes) counts[byte] += 1
  let entropy = 0
  for (const count of counts) {
    if (count === 0) continue
    const probability = count / bytes.length
    entropy -= probability * Math.log2(probability)
  }
  return entropy
}

export function slidingWindowEntropy(bytes: Uint8Array, windowSize = 256): EntropyChunk[] {
  if (!Number.isInteger(windowSize) || windowSize < 1) throw new RangeError('Window size must be a positive integer')
  const chunks: EntropyChunk[] = []
  for (let offset = 0; offset < bytes.length; offset += windowSize) {
    chunks.push({ offset, entropy: shannonEntropy(bytes.subarray(offset, offset + windowSize)) })
  }
  return chunks
}

export function byteStats(bytes: Uint8Array): ByteStats {
  const counts = new Uint32Array(256)
  let printableAsciiCount = 0
  let nullByteCount = 0
  for (const byte of bytes) {
    counts[byte] += 1
    if (byte >= 0x20 && byte <= 0x7e) printableAsciiCount += 1
    if (byte === 0) nullByteCount += 1
  }
  const present = Array.from(counts, (count, byte) => ({ byte, count })).filter((item) => item.count > 0)
  const highest = present.length ? Math.max(...present.map((item) => item.count)) : 0
  const lowest = present.length ? Math.min(...present.map((item) => item.count)) : 0
  return {
    length: bytes.length,
    printableAsciiCount,
    nonPrintableCount: bytes.length - printableAsciiCount,
    mostCommonBytes: present.filter((item) => item.count === highest),
    leastCommonBytes: present.filter((item) => item.count === lowest),
    uniqueByteCount: present.length,
    nullByteCount,
  }
}

export function analyzeEntropy(bytes: Uint8Array, windowSize = 256): EntropyAnalysis {
  const entropy = shannonEntropy(bytes)
  return {
    entropy,
    normalizedEntropy: entropy / 8,
    chunks: slidingWindowEntropy(bytes, windowSize),
    stats: byteStats(bytes),
  }
}
