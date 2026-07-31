import { decodeHexBytes, formatHexBytes } from '../hex/hex'
import { convertTimestamp, type TimestampConversions } from '../timestamp/timestamp'

const FILETIME_EPOCH_OFFSET_MS = 11_644_473_600_000n

export interface SidConversion { sid: string; hex: string }
export interface GuidConversion { canonical: string; binaryHex: string }
export type TimeConversion = { kind: 'date'; timestamp: TimestampConversions } | { kind: 'never'; label: 'Never' }
export interface AccessMaskFlag { bit: string; name: string }
export interface AccessMaskConversion { value: string; flags: AccessMaskFlag[]; unknownBits: string | null }
export interface NamedNumberConversion { value: string; label: string }

function cleanHex(value: string): Uint8Array {
  const input = value.trim()
  if (!input) throw new Error('Enter hexadecimal bytes')
  const bytes = decodeHexBytes(input)
  if (!bytes.length) throw new Error('Enter hexadecimal bytes')
  return bytes
}

function parseUnsigned(value: string, label: string): bigint {
  const input = value.trim()
  if (!input) throw new Error(`Enter ${label}`)
  if (!/^(?:0x[0-9a-f]+|\d+)$/iu.test(input)) throw new Error(`${label} must be a positive decimal or hexadecimal integer`)
  return BigInt(input)
}

export function sidFromBinary(value: string): SidConversion {
  const bytes = cleanHex(value)
  if (bytes.length < 8) throw new Error('A binary SID must contain at least 8 bytes')
  const count = bytes[1]
  if (count > 15 || bytes.length !== 8 + count * 4) throw new Error('The binary SID length does not match its sub-authority count')
  let authority = 0n
  for (let index = 2; index < 8; index += 1) authority = (authority << 8n) | BigInt(bytes[index])
  const parts = [`S-${bytes[0]}-${authority}`]
  for (let offset = 8; offset < bytes.length; offset += 4) {
    const part = bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] * 0x1000000)
    parts.push(String(part >>> 0))
  }
  return { sid: parts.join('-'), hex: formatHexBytes(bytes) }
}

export function sidToBinary(value: string): SidConversion {
  const input = value.trim()
  const match = /^S-(\d+)-(\d+)((?:-\d+)*)$/iu.exec(input)
  if (!match) throw new Error('Enter a SID such as S-1-5-18')
  const revision = Number(match[1])
  const authority = BigInt(match[2])
  const subAuthorities = match[3] ? match[3].slice(1).split('-').map(BigInt) : []
  if (revision > 255 || authority > 0xffffffffffffn || subAuthorities.length > 15 || subAuthorities.some((part) => part > 0xffffffffn)) throw new Error('The SID contains a value outside the Windows SID range')
  const bytes = new Uint8Array(8 + subAuthorities.length * 4)
  bytes[0] = revision
  bytes[1] = subAuthorities.length
  for (let index = 0; index < 6; index += 1) bytes[7 - index] = Number((authority >> BigInt(index * 8)) & 0xffn)
  subAuthorities.forEach((part, index) => {
    for (let byte = 0; byte < 4; byte += 1) bytes[8 + index * 4 + byte] = Number((part >> BigInt(byte * 8)) & 0xffn)
  })
  return { sid: `S-${revision}-${authority}${subAuthorities.map((part) => `-${part}`).join('')}`, hex: formatHexBytes(bytes) }
}

export function convertSid(value: string): SidConversion {
  return /^S-/iu.test(value.trim()) ? sidToBinary(value) : sidFromBinary(value)
}

export function guidFromBinary(value: string): GuidConversion {
  const bytes = cleanHex(value)
  if (bytes.length !== 16) throw new Error('A binary GUID must contain exactly 16 bytes')
  const order = [3, 2, 1, 0, 5, 4, 7, 6, 8, 9, 10, 11, 12, 13, 14, 15]
  const hex = order.map((index) => bytes[index].toString(16).padStart(2, '0')).join('')
  return { canonical: `{${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}}`, binaryHex: formatHexBytes(bytes) }
}

export function guidToBinary(value: string): GuidConversion {
  const input = value.trim().replace(/^\{|\}$/gu, '').toLowerCase()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(input)) throw new Error('Enter a canonical GUID with five hexadecimal groups')
  const canonicalBytes = decodeHexBytes(input.replace(/-/gu, ''))
  const order = [3, 2, 1, 0, 5, 4, 7, 6, 8, 9, 10, 11, 12, 13, 14, 15]
  const binary = Uint8Array.from(order, (index) => canonicalBytes[index])
  return { canonical: `{${input}}`, binaryHex: formatHexBytes(binary) }
}

export function convertGuid(value: string): GuidConversion {
  return /-/u.test(value) ? guidToBinary(value) : guidFromBinary(value)
}

function timestampFromEpochMs(milliseconds: bigint, label: string): TimeConversion {
  const numeric = Number(milliseconds)
  if (!Number.isSafeInteger(numeric)) throw new Error(`${label} is outside the supported date range`)
  try { return { kind: 'date', timestamp: convertTimestamp(numeric) } } catch { throw new Error(`${label} is outside the supported date range`) }
}

export function convertFiletime(value: string): TimeConversion {
  const ticks = parseUnsigned(value, 'FILETIME')
  if (ticks === 0n || ticks === 0x7fffffffffffffffn) return { kind: 'never', label: 'Never' }
  return timestampFromEpochMs(ticks / 10_000n - FILETIME_EPOCH_OFFSET_MS, 'FILETIME')
}

export function convertWebkitTime(value: string): TimeConversion {
  const microseconds = parseUnsigned(value, 'WebKit timestamp')
  return timestampFromEpochMs(microseconds / 1_000n - FILETIME_EPOCH_OFFSET_MS, 'WebKit timestamp')
}

export interface UnixConversion { detectedUnit: 'seconds' | 'milliseconds'; timestamp: TimestampConversions }

export function convertUnixAuto(value: string): UnixConversion {
  const input = value.trim()
  if (!/^-?\d+$/u.test(input)) throw new Error('Unix timestamp must be an integer')
  const raw = BigInt(input)
  // Elf cijfers of minder is in de praktijk seconden; grotere waarden zijn milliseconden.
  const detectedUnit = (raw < 0n ? -raw : raw) >= 100_000_000_000n ? 'milliseconds' : 'seconds'
  const milliseconds = detectedUnit === 'seconds' ? raw * 1_000n : raw
  const result = timestampFromEpochMs(milliseconds, 'Unix timestamp')
  if (result.kind !== 'date') throw new Error('Unix timestamp is invalid')
  return { detectedUnit, timestamp: result.timestamp }
}

const ACCESS_FLAGS = [
  [0x80000000, 'GENERIC_READ'], [0x40000000, 'GENERIC_WRITE'], [0x20000000, 'GENERIC_EXECUTE'], [0x10000000, 'GENERIC_ALL'],
  [0x01000000, 'ACCESS_SYSTEM_SECURITY'], [0x00100000, 'SYNCHRONIZE'], [0x00080000, 'WRITE_OWNER'], [0x00040000, 'WRITE_DAC'], [0x00020000, 'READ_CONTROL'], [0x00010000, 'DELETE'],
  [0x00000100, 'FILE_WRITE_ATTRIBUTES / KEY_CREATE_LINK'], [0x00000080, 'FILE_READ_ATTRIBUTES / KEY_ENUMERATE_SUB_KEYS'],
  [0x00000040, 'FILE_DELETE_CHILD / KEY_NOTIFY'], [0x00000020, 'FILE_EXECUTE / KEY_CREATE_SUB_KEY'], [0x00000010, 'FILE_WRITE_EA / KEY_SET_VALUE'],
  [0x00000008, 'FILE_READ_EA / KEY_QUERY_VALUE'], [0x00000004, 'FILE_APPEND_DATA / FILE_ADD_SUBDIRECTORY'], [0x00000002, 'FILE_WRITE_DATA / FILE_ADD_FILE'], [0x00000001, 'FILE_READ_DATA / FILE_LIST_DIRECTORY'],
] as const

export function decodeAccessMask(value: string): AccessMaskConversion {
  const parsed = parseUnsigned(value, 'access mask')
  if (parsed > 0xffffffffn) throw new Error('Access mask must fit in 32 bits')
  const mask = Number(parsed)
  const flags = ACCESS_FLAGS.filter(([bit]) => (mask & bit) !== 0).map(([bit, name]) => ({ bit: `0x${bit.toString(16).toUpperCase().padStart(8, '0')}`, name }))
  const known = ACCESS_FLAGS.reduce((total, [bit]) => total | bit, 0) >>> 0
  const unknown = (mask & ~known) >>> 0
  return { value: `0x${mask.toString(16).toUpperCase().padStart(8, '0')}`, flags, unknownBits: unknown ? `0x${unknown.toString(16).toUpperCase().padStart(8, '0')}` : null }
}

const LOGON_TYPES: Record<number, string> = { 0: 'System', 2: 'Interactive', 3: 'Network', 4: 'Batch', 5: 'Service', 7: 'Unlock', 8: 'NetworkCleartext', 9: 'NewCredentials', 10: 'RemoteInteractive', 11: 'CachedInteractive', 12: 'CachedRemoteInteractive', 13: 'CachedUnlock' }

export function convertLogonType(value: string): NamedNumberConversion {
  const parsed = parseUnsigned(value, 'logon type')
  if (parsed > 0xffffffffn) throw new Error('Logon type is outside the supported range')
  const number = Number(parsed)
  const label = LOGON_TYPES[number]
  if (!label) throw new Error('This logon type is not recognized')
  return { value: String(number), label }
}

export function convertIntegrityLevel(value: string): NamedNumberConversion {
  const input = value.trim()
  const sidMatch = /^S-1-16-(\d+)$/iu.exec(input)
  const parsed = parseUnsigned(sidMatch?.[1] ?? input, 'integrity RID')
  if (parsed > 0xffffffffn) throw new Error('Integrity RID is outside the supported range')
  const rid = Number(parsed)
  let label: string
  if (rid < 0x1000) label = 'Untrusted'
  else if (rid < 0x2000) label = 'Low'
  else if (rid < 0x3000) label = 'Medium'
  else if (rid < 0x4000) label = 'High'
  else label = 'System'
  return { value: String(rid), label }
}
