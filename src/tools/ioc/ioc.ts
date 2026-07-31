import { defang, refang } from '../defang/defang'

export const iocTypes = ['ipv4', 'ipv6', 'domain', 'url', 'md5', 'sha1', 'sha256', 'email', 'cve', 'windows-path', 'registry-key'] as const

export type IocType = (typeof iocTypes)[number]
export type IocOutputMode = 'refang' | 'defang'

export interface IocEntry {
  type: IocType
  value: string
  count: number
  sourceLines: number[]
}

export interface IocGroup {
  type: IocType
  count: number
  entries: IocEntry[]
}

export interface IocResult {
  groups: IocGroup[]
  total: number
  rejectedCount: number
}

export interface ExtractIocOptions {
  output?: IocOutputMode
}

interface FoundCandidate {
  type: IocType
  value: string
  line: number
}

const TRAILING_PUNCTUATION = /[.,;:)\]}'">]+$/u
const DOMAIN_CANDIDATE = /(?<![\w@.-])(?:[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?\.)+[a-z0-9_-]{2,63}(?![\w.-])/giu
const IPV4_CANDIDATE = /(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])/gu
const EMAIL_CANDIDATE = /(?<![\w.+-])[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-z0-9_-]+\.)+[a-z0-9_-]{2,63}/giu
const URL_CANDIDATE = /\bhttps?:\/\/[^\s<>]+/giu
const HASH_CANDIDATE = /(?<![a-f0-9])[a-f0-9]{32}(?:[a-f0-9]{8})?(?:[a-f0-9]{24})?(?![a-f0-9])/giu
const CVE_CANDIDATE = /(?<![a-z0-9])CVE-\d{4}-\d{4,}(?!\d)/giu
const WINDOWS_PATH_CANDIDATE = /(?:\b[A-Za-z]:\\|\\\\[A-Za-z0-9._$-]+\\)[^\s<>|"?*]+/gu
const REGISTRY_CANDIDATE = /\b(?:HKEY_(?:LOCAL_MACHINE|CURRENT_USER|CLASSES_ROOT|USERS|CURRENT_CONFIG)|HKLM|HKCU|HKCR|HKU|HKCC)\\[^\s,;]+/giu

function stripTrailing(value: string): string {
  return value.replace(TRAILING_PUNCTUATION, '')
}

function validIpv4(value: string): boolean {
  const parts = value.split('.')
  return parts.length === 4 && parts.every((part) => /^\d{1,3}$/u.test(part) && Number(part) <= 255)
}

function validIpv6(value: string): boolean {
  try {
    const url = new URL(`http://[${value}]/`)
    return url.hostname.startsWith('[') && url.hostname.endsWith(']')
  } catch {
    return false
  }
}

function validDomain(value: string): boolean {
  if (value.length > 253 || value.endsWith('.')) return false
  const labels = value.split('.')
  const tld = labels.at(-1) ?? ''
  return labels.length >= 2
    && (/^[a-z]{2,63}$/iu.test(tld) || /^xn--[a-z0-9-]{2,59}$/iu.test(tld))
    && labels.every((label) => label.length <= 63 && /^(?!-)[a-z0-9-]+(?<!-)$/iu.test(label))
}

function normalizeUrl(value: string): string | undefined {
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined
    const authorityStart = value.indexOf('://') + 3
    const suffixStart = value.slice(authorityStart).search(/[/?#]/u)
    const suffix = suffixStart === -1 ? '' : value.slice(authorityStart + suffixStart)
    const port = parsed.port ? `:${parsed.port}` : ''
    const credentials = parsed.username ? `${parsed.username}${parsed.password ? `:${parsed.password}` : ''}@` : ''
    return `${parsed.protocol.toLowerCase()}//${credentials}${parsed.hostname.toLowerCase()}${port}${suffix}`
  } catch {
    return undefined
  }
}

function addMatches(line: string, lineNumber: number, regex: RegExp, type: IocType, found: FoundCandidate[], occupied: Array<[number, number]>, transform?: (value: string) => string | undefined): number {
  let rejected = 0
  for (const match of line.matchAll(regex)) {
    const start = match.index
    const raw = stripTrailing(match[0])
    const end = start + raw.length
    if (!raw || occupied.some(([from, to]) => start < to && end > from)) continue
    const value = transform ? transform(raw) : raw
    if (value === undefined) {
      rejected += 1
      occupied.push([start, end])
      continue
    }
    found.push({ type, value, line: lineNumber })
    occupied.push([start, end])
  }
  return rejected
}

function ipv6Candidates(line: string): Array<{ value: string, index: number }> {
  const results: Array<{ value: string, index: number }> = []
  for (const match of line.matchAll(/(?<![\w:])(?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}(?![\w:])/giu)) {
    const value = match[0].replace(/^:/u, '').replace(/:$/u, '')
    if (value.includes(':')) results.push({ value, index: match.index + (match[0].startsWith(':') ? 1 : 0) })
  }
  return results
}

function displayValue(value: string, mode: IocOutputMode): string {
  return mode === 'defang' ? defang(value) : value
}

export function extractIocs(text: string, options: ExtractIocOptions = {}): IocResult {
  const mode = options.output ?? 'refang'
  const found: FoundCandidate[] = []
  let rejectedCount = 0

  refang(text).split(/\r?\n/u).forEach((line, index) => {
    const lineNumber = index + 1
    const occupied: Array<[number, number]> = []
    rejectedCount += addMatches(line, lineNumber, URL_CANDIDATE, 'url', found, occupied, normalizeUrl)
    rejectedCount += addMatches(line, lineNumber, EMAIL_CANDIDATE, 'email', found, occupied, (value) => {
      const separator = value.lastIndexOf('@')
      const local = value.slice(0, separator)
      const domain = value.slice(separator + 1).toLowerCase()
      return validDomain(domain) ? `${local}@${domain}` : undefined
    })
    for (const match of line.matchAll(HASH_CANDIDATE)) {
      const start = match.index
      const end = start + match[0].length
      if (occupied.some(([from, to]) => start < to && end > from)) continue
      const lengthTypes: Partial<Record<number, IocType>> = { 32: 'md5', 40: 'sha1', 64: 'sha256' }
      const type = lengthTypes[match[0].length]
      occupied.push([start, end])
      if (type) found.push({ type, value: match[0].toLowerCase(), line: lineNumber })
      else rejectedCount += 1
    }
    rejectedCount += addMatches(line, lineNumber, CVE_CANDIDATE, 'cve', found, occupied, (value) => value.toUpperCase())
    rejectedCount += addMatches(line, lineNumber, REGISTRY_CANDIDATE, 'registry-key', found, occupied)
    rejectedCount += addMatches(line, lineNumber, WINDOWS_PATH_CANDIDATE, 'windows-path', found, occupied)
    rejectedCount += addMatches(line, lineNumber, IPV4_CANDIDATE, 'ipv4', found, occupied, (value) => validIpv4(value) ? value : undefined)
    for (const candidate of ipv6Candidates(line)) {
      const end = candidate.index + candidate.value.length
      if (occupied.some(([from, to]) => candidate.index < to && end > from)) continue
      occupied.push([candidate.index, end])
      if (validIpv6(candidate.value)) found.push({ type: 'ipv6', value: candidate.value.toLowerCase(), line: lineNumber })
      else rejectedCount += 1
    }
    rejectedCount += addMatches(line, lineNumber, DOMAIN_CANDIDATE, 'domain', found, occupied, (value) => validDomain(value) ? value.toLowerCase() : undefined)
  })

  const grouped = new Map<IocType, Map<string, IocEntry>>()
  for (const item of found) {
    const entries = grouped.get(item.type) ?? new Map<string, IocEntry>()
    grouped.set(item.type, entries)
    const key = ['domain', 'md5', 'sha1', 'sha256', 'email'].includes(item.type) ? item.value.toLowerCase() : item.value
    const existing = entries.get(key)
    if (existing) {
      existing.count += 1
      if (!existing.sourceLines.includes(item.line)) existing.sourceLines.push(item.line)
    } else {
      entries.set(key, { type: item.type, value: displayValue(item.value, mode), count: 1, sourceLines: [item.line] })
    }
  }

  const groups = iocTypes.map((type) => {
    const entries = [...(grouped.get(type)?.values() ?? [])].sort((a, b) => a.value.localeCompare(b.value))
    return { type, count: entries.length, entries }
  })
  return { groups, total: groups.reduce((sum, group) => sum + group.count, 0), rejectedCount }
}

export function iocsToJson(result: IocResult): string {
  return JSON.stringify(result.groups.flatMap((group) => group.entries), null, 2)
}

export function iocsToCsv(result: IocResult): string {
  const escape = (value: string | number) => `"${String(value).replace(/"/gu, '""')}"`
  const rows = result.groups.flatMap((group) => group.entries.map((entry) => [entry.type, entry.value, entry.count, entry.sourceLines.join(';')]))
  return [['type', 'value', 'count', 'source lines'], ...rows].map((row) => row.map(escape).join(',')).join('\n')
}
