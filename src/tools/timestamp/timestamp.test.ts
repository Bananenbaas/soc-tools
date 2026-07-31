import { describe, expect, it } from 'vitest'
import { convertTimestamp, parseTimestamp } from './timestamp'

describe('Timestamp', () => {
  it('converts the Unix epoch across formats', () => {
    const output = convertTimestamp(parseTimestamp('0', 'seconds'))
    expect(output.milliseconds).toBe('0')
    expect(output.filetime).toBe('116444736000000000')
    expect(output.iso).toBe('1970-01-01T00:00:00.000Z')
  })
  it('parses milliseconds and FILETIME', () => {
    expect(parseTimestamp('1704067200000', 'milliseconds')).toBe(1704067200000)
    expect(parseTimestamp('133485408000000000', 'filetime')).toBe(1704067200000)
  })
  it('parses an explicit UTC human date', () => {
    expect(parseTimestamp('2024-01-01T00:00:00Z', 'human')).toBe(1704067200000)
  })
  it.each([['abc', 'seconds'], ['1.5', 'milliseconds'], ['no date', 'human'] ] as const)('rejects invalid %j', (value, type) => {
    expect(() => parseTimestamp(value, type)).toThrow()
  })
})
