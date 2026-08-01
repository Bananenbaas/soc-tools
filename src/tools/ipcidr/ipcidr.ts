export type IpVersion = 4 | 6

export interface ParsedIp {
  version: IpVersion
  value: bigint
  prefixLength: number
  address: string
  expanded: string
}

export interface CidrInfo extends ParsedIp {
  network: string
  networkExpanded: string
  firstAddress: string
  lastAddress: string
  totalAddresses: string
  broadcast?: string
  firstUsable?: string
  lastUsable?: string
  usableCount?: string
  netmask?: string
  wildcard?: string
}

export interface AddressClassification {
  kind: 'private' | 'loopback' | 'link-local' | 'multicast' | 'documentation' | 'reserved/unspecified' | 'global unicast (public)'
  matchedRange: string
}

const V4_BITS = 32
const V6_BITS = 128

function parseIPv4Value(input: string): bigint {
  const parts = input.split('.')
  if (parts.length !== 4) throw new Error('Invalid IPv4 address: expected four decimal octets.')
  let value = 0n
  for (const part of parts) {
    if (!/^(0|[1-9]\d{0,2})$/u.test(part)) throw new Error('Invalid IPv4 address: octets must be decimal numbers from 0 to 255 without leading zeroes.')
    const octet = Number(part)
    if (octet > 255) throw new Error('Invalid IPv4 address: each octet must be from 0 to 255.')
    value = (value << 8n) | BigInt(octet)
  }
  return value
}

function parseIPv6Value(input: string): bigint {
  if (!input || input.includes('%')) throw new Error('Invalid IPv6 address: zone identifiers are not supported.')
  if ((input.match(/::/gu) ?? []).length > 1) throw new Error('Invalid IPv6 address: only one :: compression marker is allowed.')

  let source = input.toLowerCase()
  if (source.includes('.')) {
    const lastColon = source.lastIndexOf(':')
    if (lastColon < 0) throw new Error('Invalid IPv6 address: embedded IPv4 address has no IPv6 prefix.')
    const v4 = parseIPv4Value(source.slice(lastColon + 1))
    source = `${source.slice(0, lastColon)}:${((v4 >> 16n) & 0xffffn).toString(16)}:${(v4 & 0xffffn).toString(16)}`
  }

  const compressed = source.includes('::')
  const sides = source.split('::')
  const left = sides[0] ? sides[0].split(':') : []
  const right = sides[1] ? sides[1].split(':') : []
  const groups = [...left, ...right]
  if (groups.some((group) => !/^[0-9a-f]{1,4}$/u.test(group))) throw new Error('Invalid IPv6 address: each group must contain one to four hexadecimal digits.')
  if ((!compressed && groups.length !== 8) || (compressed && groups.length >= 8)) throw new Error('Invalid IPv6 address: expected eight groups, with :: replacing at least one group.')
  const complete = compressed
    ? [...left, ...Array<string>(8 - groups.length).fill('0'), ...right]
    : groups
  let value = 0n
  for (const group of complete) value = (value << 16n) | BigInt(`0x${group}`)
  return value
}

export function ipv4ToInteger(address: string): bigint {
  return parseIPv4Value(address.trim())
}

export function integerToIpv4(value: bigint): string {
  if (value < 0n || value >= (1n << 32n)) throw new Error('IPv4 integer must be from 0 through 4294967295.')
  return [24n, 16n, 8n, 0n].map((shift) => Number((value >> shift) & 255n)).join('.')
}

export function expandIpv6(address: string): string {
  return formatIpv6Expanded(parseIPv6Value(address.trim()))
}

export function compressIpv6(address: string): string {
  return formatIpv6(parseIPv6Value(address.trim()))
}

function formatIpv6Expanded(value: bigint): string {
  return Array.from({ length: 8 }, (_, index) => Number((value >> BigInt((7 - index) * 16)) & 0xffffn).toString(16).padStart(4, '0')).join(':')
}

function formatIpv6(value: bigint): string {
  const groups = formatIpv6Expanded(value).split(':').map((group) => group.replace(/^0+(?=[0-9a-f])/u, ''))
  let bestStart = -1
  let bestLength = 0
  for (let start = 0; start < groups.length;) {
    if (groups[start] !== '0') { start += 1; continue }
    let end = start
    while (end < groups.length && groups[end] === '0') end += 1
    if (end - start > bestLength && end - start >= 2) { bestStart = start; bestLength = end - start }
    start = end
  }
  if (bestStart < 0) return groups.join(':')
  const left = groups.slice(0, bestStart).join(':')
  const right = groups.slice(bestStart + bestLength).join(':')
  return `${left}::${right}`
}

export function parseIp(input: string): ParsedIp {
  const trimmed = input.trim()
  if (!trimmed) throw new Error('Enter an IPv4 or IPv6 address, optionally followed by a CIDR prefix.')
  if (/\s/u.test(trimmed)) throw new Error('IP addresses and CIDR prefixes cannot contain whitespace.')
  const pieces = trimmed.split('/')
  if (pieces.length > 2 || !pieces[0]) throw new Error('Invalid CIDR: use one address and at most one prefix length.')
  const version: IpVersion = pieces[0].includes(':') ? 6 : 4
  const bits = version === 4 ? V4_BITS : V6_BITS
  const value = version === 4 ? parseIPv4Value(pieces[0]) : parseIPv6Value(pieces[0])
  let prefixLength = bits
  if (pieces.length === 2) {
    if (!/^(0|[1-9]\d*)$/u.test(pieces[1])) throw new Error(`Invalid IPv${version} prefix: expected an integer from 0 to ${bits}.`)
    prefixLength = Number(pieces[1])
    if (prefixLength > bits) throw new Error(`Invalid IPv${version} prefix: expected an integer from 0 to ${bits}.`)
  }
  return {
    version,
    value,
    prefixLength,
    address: version === 4 ? integerToIpv4(value) : formatIpv6(value),
    expanded: version === 4 ? integerToIpv4(value) : formatIpv6Expanded(value),
  }
}

export function calculateCidr(input: string): CidrInfo {
  const parsed = parseIp(input)
  const bits = parsed.version === 4 ? V4_BITS : V6_BITS
  const hostBits = bits - parsed.prefixLength
  const all = (1n << BigInt(bits)) - 1n
  const hostMask = hostBits === 0 ? 0n : (1n << BigInt(hostBits)) - 1n
  const networkValue = parsed.value & (all ^ hostMask)
  const lastValue = networkValue | hostMask
  const format = parsed.version === 4 ? integerToIpv4 : formatIpv6
  const result: CidrInfo = {
    ...parsed,
    network: format(networkValue),
    networkExpanded: parsed.version === 4 ? integerToIpv4(networkValue) : formatIpv6Expanded(networkValue),
    firstAddress: format(networkValue),
    lastAddress: format(lastValue),
    totalAddresses: (1n << BigInt(hostBits)).toString(),
  }
  if (parsed.version === 4) {
    const total = 1n << BigInt(hostBits)
    const usable = parsed.prefixLength <= 30 ? total - 2n : total
    const firstUsableValue = parsed.prefixLength <= 30 ? networkValue + 1n : networkValue
    const lastUsableValue = parsed.prefixLength <= 30 ? lastValue - 1n : lastValue
    result.broadcast = integerToIpv4(lastValue)
    result.firstUsable = integerToIpv4(firstUsableValue)
    result.lastUsable = integerToIpv4(lastUsableValue)
    result.usableCount = usable.toString()
    result.netmask = integerToIpv4(all ^ hostMask)
    result.wildcard = integerToIpv4(hostMask)
  }
  return result
}

export function isIpInCidr(ip: string, cidr: string): boolean {
  const address = parseIp(ip)
  const range = parseIp(cidr)
  if (ip.includes('/')) throw new Error('Membership input must be a single IP address without a prefix.')
  if (address.version !== range.version) throw new Error('The membership IP and CIDR must use the same IP version.')
  const bits = range.version === 4 ? V4_BITS : V6_BITS
  const hostBits = bits - range.prefixLength
  const mask = ((1n << BigInt(bits)) - 1n) ^ (hostBits ? (1n << BigInt(hostBits)) - 1n : 0n)
  return (address.value & mask) === (range.value & mask)
}

interface ClassificationRange { version: IpVersion, cidr: string, kind: AddressClassification['kind'] }

const CLASSIFICATION_RANGES: readonly ClassificationRange[] = [
  { version: 4, cidr: '10.0.0.0/8', kind: 'private' },
  { version: 4, cidr: '172.16.0.0/12', kind: 'private' },
  { version: 4, cidr: '192.168.0.0/16', kind: 'private' },
  { version: 6, cidr: 'fc00::/7', kind: 'private' },
  { version: 4, cidr: '127.0.0.0/8', kind: 'loopback' },
  { version: 6, cidr: '::1/128', kind: 'loopback' },
  { version: 4, cidr: '169.254.0.0/16', kind: 'link-local' },
  { version: 6, cidr: 'fe80::/10', kind: 'link-local' },
  { version: 4, cidr: '224.0.0.0/4', kind: 'multicast' },
  { version: 6, cidr: 'ff00::/8', kind: 'multicast' },
  { version: 4, cidr: '192.0.2.0/24', kind: 'documentation' },
  { version: 4, cidr: '198.51.100.0/24', kind: 'documentation' },
  { version: 4, cidr: '203.0.113.0/24', kind: 'documentation' },
  { version: 6, cidr: '2001:db8::/32', kind: 'documentation' },
  { version: 4, cidr: '0.0.0.0/8', kind: 'reserved/unspecified' },
  { version: 4, cidr: '240.0.0.0/4', kind: 'reserved/unspecified' },
  { version: 6, cidr: '::/128', kind: 'reserved/unspecified' },
]

export function classifyIp(input: string): AddressClassification {
  const parsed = parseIp(input)
  for (const range of CLASSIFICATION_RANGES) {
    if (parsed.version === range.version && isIpInCidr(parsed.address, range.cidr)) return { kind: range.kind, matchedRange: range.cidr }
  }
  return { kind: 'global unicast (public)', matchedRange: parsed.version === 4 ? '0.0.0.0/0 (no listed special-use range matched)' : '::/0 (no listed special-use range matched)' }
}
