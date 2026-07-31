import { convertTimestamp, parseTimestamp } from '../timestamp/timestamp'

export type NetLogFormat = 'zeek-tsv' | 'zeek-json' | 'suricata-eve' | 'unknown'
export type NetLogValue = string | number | boolean

export interface NetLogRecord {
  timestampOriginal?: string
  timestampUtc?: string
  src_ip?: string
  dest_ip?: string
  src_port?: number
  dest_port?: number
  proto?: string
  event_type?: string
  service?: string
  duration?: number
  orig_bytes?: number
  resp_bytes?: number
  alert_signature?: string
  alert_category?: string
  domain?: string
  ja3?: string
  ja3s?: string
  fields: Record<string, NetLogValue>
}

export interface CountedValue { value: string; count: number }
export interface FlowSummary { src_ip: string; dest_ip: string; dest_port?: number; proto: string; count: number; bytes: number }
export interface NetLogResult {
  format: NetLogFormat
  records: NetLogRecord[]
  detectedFields: string[]
  skippedCount: number
  flows: FlowSummary[]
  unique: { hosts: CountedValue[]; domains: CountedValue[]; ja3: CountedValue[] }
}

type JsonObject = Record<string, unknown>

function object(value: unknown): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}
}

function scalar(value: unknown): NetLogValue | undefined {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  return undefined
}

function text(value: unknown): string | undefined {
  const item = scalar(value)
  return item === undefined || item === '-' || item === '(empty)' || item === '' ? undefined : String(item)
}

function numberValue(value: unknown): number | undefined {
  const item = text(value)
  if (item === undefined) return undefined
  const parsed = Number(item)
  return Number.isFinite(parsed) ? parsed : undefined
}

function nestedFingerprint(container: JsonObject, key: 'ja3' | 'ja3s'): string | undefined {
  const value = container[key]
  return text(value) ?? text(object(value).hash) ?? text(object(value).md5)
}

function utcTimestamp(value: unknown, zeek: boolean): string | undefined {
  const original = text(value)
  if (!original) return undefined
  try {
    const epochMs = zeek ? Number(original) * 1000 : parseTimestamp(original, 'human')
    if (!Number.isFinite(epochMs)) return undefined
    return convertTimestamp(epochMs).iso
  } catch {
    return undefined
  }
}

function normalizeJson(raw: JsonObject, format: Exclude<NetLogFormat, 'zeek-tsv' | 'unknown'>): NetLogRecord {
  const suricata = format === 'suricata-eve'
  const alert = object(raw.alert)
  const dns = object(raw.dns)
  const http = object(raw.http)
  const tls = object(raw.tls)
  const ssl = object(raw.ssl)
  const fields: Record<string, NetLogValue> = {}
  for (const [key, value] of Object.entries(raw)) {
    const item = scalar(value)
    if (item !== undefined && item !== '-' && item !== '(empty)' && item !== '') fields[key] = item
  }
  const timestamp = suricata ? raw.timestamp : raw.ts
  return {
    timestampOriginal: text(timestamp), timestampUtc: utcTimestamp(timestamp, !suricata),
    src_ip: text(suricata ? raw.src_ip : raw['id.orig_h']), dest_ip: text(suricata ? raw.dest_ip : raw['id.resp_h']),
    src_port: numberValue(suricata ? raw.src_port : raw['id.orig_p']), dest_port: numberValue(suricata ? raw.dest_port : raw['id.resp_p']),
    proto: text(raw.proto)?.toLowerCase(), event_type: text(raw.event_type), service: text(raw.service), duration: numberValue(raw.duration),
    orig_bytes: numberValue(raw.orig_bytes), resp_bytes: numberValue(raw.resp_bytes),
    alert_signature: text(alert.signature), alert_category: text(alert.category),
    domain: text(dns.rrname) ?? text(http.hostname) ?? text(tls.sni) ?? text(ssl.sni),
    ja3: nestedFingerprint(tls, 'ja3') ?? nestedFingerprint(ssl, 'ja3'),
    ja3s: nestedFingerprint(tls, 'ja3s') ?? nestedFingerprint(ssl, 'ja3s'), fields,
  }
}

function detectJson(values: JsonObject[]): 'zeek-json' | 'suricata-eve' {
  return values.some((value) => 'event_type' in value || 'timestamp' in value || 'src_ip' in value) ? 'suricata-eve' : 'zeek-json'
}

export function summarizeFlows(records: NetLogRecord[]): FlowSummary[] {
  const groups = new Map<string, FlowSummary>()
  for (const record of records) {
    const key = JSON.stringify([record.src_ip ?? '', record.dest_ip ?? '', record.dest_port ?? null, record.proto ?? ''])
    const current = groups.get(key) ?? { src_ip: record.src_ip ?? '', dest_ip: record.dest_ip ?? '', dest_port: record.dest_port, proto: record.proto ?? '', count: 0, bytes: 0 }
    current.count += 1
    current.bytes += (record.orig_bytes ?? 0) + (record.resp_bytes ?? 0)
    groups.set(key, current)
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || b.bytes - a.bytes)
}

function counted(values: Array<string | undefined>): CountedValue[] {
  const counts = new Map<string, number>()
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

export function parseNetLogs(input: string): NetLogResult {
  const lines = input.split(/\r?\n/u)
  const fieldsLine = lines.find((line) => line.startsWith('#fields'))
  const records: NetLogRecord[] = []
  let skippedCount = 0
  let format: NetLogFormat = 'unknown'

  if (fieldsLine) {
    format = 'zeek-tsv'
    const names = fieldsLine.split('\t').slice(1)
    for (const line of lines) {
      if (!line.trim() || line.startsWith('#')) continue
      const values = line.split('\t')
      if (values.length !== names.length) { skippedCount += 1; continue }
      const raw: JsonObject = Object.fromEntries(names.map((name, index) => [name, values[index]]))
      records.push(normalizeJson(raw, 'zeek-json'))
    }
  } else {
    const parsed: JsonObject[] = []
    for (const line of lines) {
      if (!line.trim() || line.trimStart().startsWith('#')) continue
      try {
        const value: unknown = JSON.parse(line)
        if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('object expected')
        parsed.push(value as JsonObject)
      } catch { skippedCount += 1 }
    }
    if (parsed.length) {
      const jsonFormat = detectJson(parsed)
      format = jsonFormat
      for (const raw of parsed) records.push(normalizeJson(raw, jsonFormat))
    }
  }
  const detectedFields = [...new Set(records.flatMap((record) => Object.keys(record.fields)))].sort()
  return {
    format, records, detectedFields, skippedCount, flows: summarizeFlows(records),
    unique: {
      hosts: counted(records.flatMap((record) => [record.src_ip, record.dest_ip])),
      domains: counted(records.map((record) => record.domain)),
      ja3: counted(records.flatMap((record) => [record.ja3, record.ja3s])),
    },
  }
}

function searchable(record: NetLogRecord): Record<string, unknown> {
  return { ...record.fields, ...record, fields: undefined, timestamp: record.timestampUtc, ts: record.timestampOriginal, alert: record.alert_signature }
}

export function filterNetLogs(records: NetLogRecord[], query: string): NetLogRecord[] {
  const tokens = query.match(/(?:[^\s"=]+=(?:"[^"]*"|[^\s]+)|"[^"]*"|[^\s]+)/gu) ?? []
  return records.filter((record) => {
    const values = searchable(record)
    return tokens.every((rawToken) => {
      const token = rawToken.replace(/^"|"$/gu, '')
      const separator = token.indexOf('=')
      if (separator < 0) return Object.values(values).some((value) => scalar(value) !== undefined && String(value).toLowerCase().includes(token.toLowerCase()))
      const field = token.slice(0, separator).toLowerCase()
      const expected = token.slice(separator + 1).replace(/^"|"$/gu, '')
      if (field === 'time_from' || field === 'time_to') {
        const boundary = Date.parse(expected)
        const actual = Date.parse(record.timestampUtc ?? '')
        return Number.isFinite(boundary) && Number.isFinite(actual) && (field === 'time_from' ? actual >= boundary : actual <= boundary)
      }
      const actual = values[field]
      if (actual === undefined) return false
      return typeof actual === 'number' ? actual === Number(expected) : String(actual).toLowerCase().includes(expected.toLowerCase())
    })
  })
}

export function netLogsToJson(records: NetLogRecord[]): string { return JSON.stringify(records, null, 2) }

export function netLogsToCsv(records: NetLogRecord[]): string {
  const headers = ['timestampUtc', 'timestampOriginal', 'src_ip', 'dest_ip', 'src_port', 'dest_port', 'proto', 'event_type', 'service', 'duration', 'orig_bytes', 'resp_bytes', 'alert_signature', 'alert_category', 'domain', 'ja3', 'ja3s'] as const
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/gu, '""')}"`
  return [headers.join(','), ...records.map((record) => headers.map((header) => escape(record[header])).join(','))].join('\n')
}
