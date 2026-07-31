import { decodeBase64Bytes } from '../base64/base64'
import { formatHexBytes } from '../hex/hex'
import { extractIocs, type IocResult } from '../ioc/ioc'

export interface PowerShellDecodeResult {
  encoded: string
  bytes: Uint8Array
  decoded: string
  normalized: string
  hexDump: string
  printableStrings: string[]
  indicators: IocResult
  cmdlets: string[]
}

const ENCODED_FLAG = /(?:^|\s)-(?:encodedcommand|enc|ec|e)(?:\s+|:)(?:"([A-Za-z0-9+/=\s]+)"|'([A-Za-z0-9+/=\s]+)'|([A-Za-z0-9+/=]+))(?=\s|$)/iu
const RAW_BASE64 = /^[A-Za-z0-9+/]+={0,2}$/u

export function extractEncodedCommand(input: string): string {
  const trimmed = input.trim()
  const flagMatch = ENCODED_FLAG.exec(trimmed)
  const candidate = (flagMatch?.[1] ?? flagMatch?.[2] ?? flagMatch?.[3] ?? trimmed).replace(/\s/gu, '')
  if (!candidate || !RAW_BASE64.test(candidate)) throw new Error('Invalid Base64 input')
  return candidate
}

function decodeUtf16Le(bytes: Uint8Array): string {
  if (bytes.byteLength % 2 !== 0) throw new Error('Invalid UTF-16LE input')
  let decoded: string
  try {
    decoded = new TextDecoder('utf-16le', { fatal: true }).decode(bytes)
  } catch {
    throw new Error('Invalid UTF-16LE input')
  }
  for (let index = 0; index < decoded.length; index += 1) {
    const code = decoded.charCodeAt(index)
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = decoded.charCodeAt(index + 1)
      if (next < 0xdc00 || next > 0xdfff) throw new Error('Invalid UTF-16LE input')
      index += 1
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new Error('Invalid UTF-16LE input')
    }
  }
  return decoded
}

export function formatByteDump(bytes: Uint8Array): string {
  const rows: string[] = []
  for (let offset = 0; offset < bytes.length; offset += 16) {
    const row = bytes.subarray(offset, offset + 16)
    const hex = formatHexBytes(row, true, 'space').padEnd(47, ' ')
    const printable = Array.from(row, (byte) => byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.').join('')
    rows.push(`${offset.toString(16).padStart(8, '0').toUpperCase()}  ${hex}  |${printable}|`)
  }
  return rows.join('\n')
}

export function extractPrintableStrings(bytes: Uint8Array, minimumLength = 4): string[] {
  const found: string[] = []
  const addRuns = (value: string) => {
    for (const match of value.matchAll(/[\x20-\x7e]{4,}/gu)) if (match[0].length >= minimumLength && !found.includes(match[0])) found.push(match[0])
  }
  addRuns(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
  if (bytes.length % 2 === 0) addRuns(decodeUtf16Le(bytes))
  return found
}

export function normalizePowerShell(script: string): string {
  let normalized = script.replace(/`([`'"$0abfnrtv])/gu, (_match, escaped: string) => {
    const escapes: Record<string, string> = { '0': '\0', a: '\x07', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v' }
    return escapes[escaped] ?? escaped
  })
  let previous = ''
  while (previous !== normalized) {
    previous = normalized
    normalized = normalized.replace(/(['"])([^'"\r\n]*)\1\s*\+\s*\1([^'"\r\n]*)\1/gu, (_match, quote: string, left: string, right: string) => `${quote}${left}${right}${quote}`)
  }
  normalized = normalized.replace(/(['"])([^'"\r\n]*)\1\s*,\s*(['"])([^'"\r\n]*)\3\s*-join\s*(['"])\5/giu, (_match, _q1: string, left: string, _q2: string, right: string) => `'${left}${right}'`)
  return normalized
}

export function extractCmdlets(script: string): string[] {
  const cmdlets = new Map<string, string>()
  for (const match of script.matchAll(/(?<![\w-])([A-Za-z][A-Za-z0-9]*-[A-Za-z][A-Za-z0-9]*)(?![\w-])/gu)) {
    const key = match[1].toLowerCase()
    if (!cmdlets.has(key)) cmdlets.set(key, match[1])
  }
  return [...cmdlets.values()]
}

export function decodePowerShellEncodedCommand(input: string): PowerShellDecodeResult {
  const encoded = extractEncodedCommand(input)
  let bytes: Uint8Array
  try {
    bytes = decodeBase64Bytes(encoded)
  } catch {
    throw new Error('Invalid Base64 input')
  }
  const decoded = decodeUtf16Le(bytes)
  return {
    encoded,
    bytes,
    decoded,
    normalized: normalizePowerShell(decoded),
    hexDump: formatByteDump(bytes),
    printableStrings: extractPrintableStrings(bytes),
    indicators: extractIocs(decoded),
    cmdlets: extractCmdlets(decoded),
  }
}
