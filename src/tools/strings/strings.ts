import { extractIocs, type IocResult } from '../ioc/ioc'

export const stringEncodings = ['ascii', 'utf-16le', 'utf-16be'] as const

export type StringEncoding = (typeof stringEncodings)[number]

export interface ExtractedString {
  encoding: StringEncoding
  offset: number
  value: string
}

export interface ExtractStringsOptions {
  minimumLength?: number
  encodings?: readonly StringEncoding[]
  deduplicate?: boolean
}

function isPrintable(value: number): boolean {
  return value >= 0x20 && value <= 0x7e
}

function asciiRuns(bytes: Uint8Array, minimumLength: number): ExtractedString[] {
  const found: ExtractedString[] = []
  let start = 0
  for (let index = 0; index <= bytes.length; index += 1) {
    if (index < bytes.length && isPrintable(bytes[index] ?? 0)) continue
    if (index - start >= minimumLength) {
      let value = ''
      for (let position = start; position < index; position += 1) value += String.fromCharCode(bytes[position] ?? 0)
      found.push({ encoding: 'ascii', offset: start, value })
    }
    start = index + 1
  }
  return found
}

function utf16Runs(bytes: Uint8Array, minimumLength: number, littleEndian: boolean): ExtractedString[] {
  const found: ExtractedString[] = []
  // Beide byte-uitlijningen worden bekeken omdat een tekenreeks op iedere offset kan beginnen.
  for (let alignment = 0; alignment < 2; alignment += 1) {
    let start = alignment
    let value = ''
    for (let index = alignment; index + 1 <= bytes.length; index += 2) {
      const complete = index + 1 < bytes.length
      const codeUnit = complete
        ? littleEndian ? (bytes[index] ?? 0) | ((bytes[index + 1] ?? 0) << 8) : ((bytes[index] ?? 0) << 8) | (bytes[index + 1] ?? 0)
        : 0
      if (complete && isPrintable(codeUnit)) {
        if (!value) start = index
        value += String.fromCharCode(codeUnit)
        continue
      }
      if (value.length >= minimumLength) found.push({ encoding: littleEndian ? 'utf-16le' : 'utf-16be', offset: start, value })
      value = ''
    }
    if (value.length >= minimumLength) found.push({ encoding: littleEndian ? 'utf-16le' : 'utf-16be', offset: start, value })
  }
  return found
}

export function extractStrings(bytes: Uint8Array, options: ExtractStringsOptions = {}): ExtractedString[] {
  const minimumLength = Math.max(1, Math.floor(options.minimumLength ?? 4))
  const encodings = new Set(options.encodings ?? stringEncodings)
  const found = [
    ...(encodings.has('ascii') ? asciiRuns(bytes, minimumLength) : []),
    ...(encodings.has('utf-16le') ? utf16Runs(bytes, minimumLength, true) : []),
    ...(encodings.has('utf-16be') ? utf16Runs(bytes, minimumLength, false) : []),
  ].sort((left, right) => left.offset - right.offset || stringEncodings.indexOf(left.encoding) - stringEncodings.indexOf(right.encoding))

  if (!options.deduplicate) return found
  const seen = new Set<string>()
  return found.filter((item) => {
    if (seen.has(item.value)) return false
    seen.add(item.value)
    return true
  })
}

export function extractStringIocs(strings: readonly ExtractedString[]): IocResult {
  return extractIocs(strings.map((item) => item.value).join('\n'))
}

export function stringsToJson(strings: readonly ExtractedString[]): string {
  return JSON.stringify(strings, null, 2)
}

export function stringsToCsv(strings: readonly ExtractedString[]): string {
  const escape = (value: string | number) => `"${String(value).replace(/"/gu, '""')}"`
  return [['encoding', 'offset_decimal', 'offset_hex', 'value'], ...strings.map((item) => [item.encoding, item.offset, `0x${item.offset.toString(16)}`, item.value])]
    .map((row) => row.map(escape).join(',')).join('\n')
}
