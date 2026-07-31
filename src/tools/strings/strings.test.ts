import { describe, expect, it } from 'vitest'
import { extractStringIocs, extractStrings } from './strings'

describe('extractStrings', () => {
  it('finds printable ASCII runs with byte offsets and applies the minimum length', () => {
    const bytes = Uint8Array.from([0, 0x41, 0x42, 0x43, 0x44, 1, 0x58, 0x59, 0, 0x74, 0x65, 0x73, 0x74])
    expect(extractStrings(bytes, { encodings: ['ascii'], minimumLength: 4 })).toEqual([
      { encoding: 'ascii', offset: 1, value: 'ABCD' },
      { encoding: 'ascii', offset: 9, value: 'test' },
    ])
  })

  it('finds embedded UTF-16LE and UTF-16BE strings at unaligned offsets', () => {
    const bytes = Uint8Array.from([0xff, 0x4c, 0, 0x45, 0, 0x21, 0, 0xff, 0, 0x42, 0, 0x45, 0, 0x21, 0xff])
    expect(extractStrings(bytes, { encodings: ['utf-16le'], minimumLength: 3 })).toContainEqual({ encoding: 'utf-16le', offset: 1, value: 'LE!' })
    expect(extractStrings(bytes, { encodings: ['utf-16be'], minimumLength: 3 })).toContainEqual({ encoding: 'utf-16be', offset: 8, value: 'BE!' })
  })

  it('surfaces indicators from an extracted ASCII URL and path', () => {
    const value = 'https://example.org/a C:\\Temp\\sample.exe'
    const strings = extractStrings(new TextEncoder().encode(value), { encodings: ['ascii'] })
    const indicators = extractStringIocs(strings)
    expect(indicators.groups.find((group) => group.type === 'url')?.entries[0]?.value).toBe('https://example.org/a')
    expect(indicators.groups.find((group) => group.type === 'windows-path')?.entries[0]?.value).toBe('C:\\Temp\\sample.exe')
  })

  it('optionally removes repeated values while preserving the first offset', () => {
    const bytes = Uint8Array.from([0x54, 0x45, 0x53, 0x54, 0, 0x54, 0x45, 0x53, 0x54])
    expect(extractStrings(bytes, { encodings: ['ascii'], deduplicate: false })).toHaveLength(2)
    expect(extractStrings(bytes, { encodings: ['ascii'], deduplicate: true })).toEqual([{ encoding: 'ascii', offset: 0, value: 'TEST' }])
  })
})
