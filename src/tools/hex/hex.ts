export type HexDelimiter = 'none' | 'space' | '0x' | '\\x'

export function formatHexBytes(bytes: Uint8Array, uppercase = false, delimiter: HexDelimiter = 'none'): string {
  const parts = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
    .map((part) => uppercase ? part.toUpperCase() : part)
  const formatted = delimiter === 'space' ? parts.join(' ')
    : delimiter === '0x' ? parts.map((part) => `0x${part}`).join(' ')
      : delimiter === '\\x' ? parts.map((part) => `\\x${part}`).join('')
        : parts.join('')
  return formatted
}

export function encodeHex(value: string, uppercase = false, delimiter: HexDelimiter = 'none'): string {
  return formatHexBytes(new TextEncoder().encode(value), uppercase, delimiter)
}

export function decodeHexBytes(value: string): Uint8Array {
  const compact = value.replace(/0x|\\x/giu, '').replace(/\s/gu, '')
  if (compact.length % 2 !== 0) throw new Error('Odd-length hex input')
  if (!/^[0-9a-f]*$/iu.test(compact)) throw new Error('Invalid hex input')
  return Uint8Array.from(compact.match(/.{2}/gu) ?? [], (pair) => Number.parseInt(pair, 16))
}

export function decodeHex(value: string): string {
  const bytes = decodeHexBytes(value)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error('Invalid UTF-8')
  }
}
