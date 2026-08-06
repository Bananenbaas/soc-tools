import { extractIocs, type IocResult } from '../ioc/ioc'
import { convertTimestamp, parseTimestamp } from '../timestamp/timestamp'

export interface EmailHeader { name: string, value: string }
export interface DisplayTimestamp { epochMs: number, utc: string, amsterdam: string }
export interface ReceivedHop {
  raw: string
  fromHost?: string
  byHost?: string
  protocol?: string
  timestampRaw?: string
  timestamp?: DisplayTimestamp
  delayToNextMs?: number
}
export interface AuthResult { source: string, method: string, result: string, raw: string }
export interface IndicatorNote { kind: 'domain-mismatch' | 'message-id-domain', domains: string[] }
export interface EmailHeaderResult {
  headers: EmailHeader[]
  fields: Array<{ name: string, values: string[] }>
  hops: ReceivedHop[]
  totalTransitMs?: number
  authentication: { summary: Record<string, string[]>, results: AuthResult[], raw: string[] }
  notes: IndicatorNote[]
  iocs: IocResult
}

const DISPLAY_FIELDS = ['From', 'To', 'Cc', 'Reply-To', 'Return-Path', 'Subject', 'Date', 'Message-ID', 'In-Reply-To', 'References', 'X-Mailer/User-Agent'] as const
const AUTH_METHODS = new Set(['spf', 'dkim', 'dmarc', 'arc', 'compauth'])

export function parseHeaders(raw: string): EmailHeader[] {
  const unfolded: string[] = []
  for (const line of raw.replace(/\r\n?/gu, '\n').split('\n')) {
    if (/^[ \t]/u.test(line) && unfolded.length) unfolded[unfolded.length - 1] += ` ${line.trimStart()}`
    else unfolded.push(line)
  }
  const headers: EmailHeader[] = []
  for (const line of unfolded) {
    if (!line) continue
    const separator = line.indexOf(':')
    if (separator <= 0) continue
    const name = line.slice(0, separator).trim()
    if (!/^[!-9;-~]+$/u.test(name)) continue
    headers.push({ name, value: line.slice(separator + 1).trim() })
  }
  return headers
}

function decodeBytes(encoded: string, encoding: string): Uint8Array | undefined {
  try {
    if (encoding.toUpperCase() === 'B') {
      const binary = atob(encoded.replace(/\s/gu, ''))
      return Uint8Array.from(binary, (character) => character.charCodeAt(0))
    }
    const bytes: number[] = []
    const value = encoded.replace(/_/gu, ' ')
    for (let index = 0; index < value.length; index += 1) {
      if (value[index] === '=' && /^[0-9a-f]{2}$/iu.test(value.slice(index + 1, index + 3))) {
        bytes.push(Number.parseInt(value.slice(index + 1, index + 3), 16)); index += 2
      } else bytes.push(value.charCodeAt(index) & 0xff)
    }
    return Uint8Array.from(bytes)
  } catch { return undefined }
}

function decodeWord(charset: string, encoding: string, encoded: string, original: string): string {
  const bytes = decodeBytes(encoded, encoding)
  if (!bytes) return original
  const normalized = charset.toLowerCase().replace(/^us-ascii$/u, 'ascii')
  if (!['utf-8', 'utf8', 'ascii', 'iso-8859-1'].includes(normalized)) return original
  try { return new TextDecoder(normalized === 'utf8' ? 'utf-8' : normalized, { fatal: true }).decode(bytes) } catch { return original }
}

export function decodeMimeWords(value: string): string {
  const pattern = /=\?([^?\s]+)\?([bq])\?([^?]*)\?=/giu
  return value.replace(/(\?=)[ \t]+(?==\?)/gu, '$1')
    .replace(pattern, (word, charset: string, encoding: string, encoded: string) => decodeWord(charset, encoding, encoded, word))
}

function displayTimestamp(value: string): DisplayTimestamp | undefined {
  try {
    const epochMs = parseTimestamp(value, 'human')
    const converted = convertTimestamp(epochMs)
    return { epochMs, utc: converted.utc, amsterdam: converted.amsterdam }
  } catch { return undefined }
}

function receivedPart(value: string, label: 'from' | 'by' | 'with'): string | undefined {
  const stop = label === 'from' ? 'by|with|via|id|for' : label === 'by' ? 'with|via|id|for' : 'via|id|for'
  const match = value.match(new RegExp(`(?:^|\\s)${label}\\s+([^\\s;(]+)(?=\\s|;|$)`, 'iu'))
  if (!match || new RegExp(`^(?:${stop})$`, 'iu').test(match[1])) return undefined
  return match[1].replace(/[),]$/u, '')
}

export function parseReceived(headers: EmailHeader[]): ReceivedHop[] {
  const hops: ReceivedHop[] = headers.filter((header) => header.name.toLowerCase() === 'received').reverse().map((header) => {
    const separator = header.value.lastIndexOf(';')
    const timestampRaw = separator >= 0 ? header.value.slice(separator + 1).trim() : undefined
    return {
      raw: header.value,
      fromHost: receivedPart(header.value, 'from'),
      byHost: receivedPart(header.value, 'by'),
      protocol: receivedPart(header.value, 'with'),
      timestampRaw,
      timestamp: timestampRaw ? displayTimestamp(timestampRaw) : undefined,
    }
  })
  return hops.map((hop, index) => {
    const next = hops[index + 1]
    if (hop.timestamp && next?.timestamp) hop.delayToNextMs = next.timestamp.epochMs - hop.timestamp.epochMs
    return hop
  })
}

export function parseAuthentication(headers: EmailHeader[]): EmailHeaderResult['authentication'] {
  const rawHeaders = headers.filter((header) => ['authentication-results', 'arc-authentication-results'].includes(header.name.toLowerCase()))
  const results: AuthResult[] = []
  for (const header of rawHeaders) {
    for (const segment of header.value.split(';')) {
      const match = segment.trim().match(/^(spf|dkim|dmarc|arc|compauth)\s*=\s*([^\s;]+)/iu)
      if (match && AUTH_METHODS.has(match[1].toLowerCase())) results.push({ source: header.name, method: match[1].toLowerCase(), result: match[2].toLowerCase(), raw: segment.trim() })
    }
  }
  for (const header of headers.filter((item) => item.name.toLowerCase() === 'received-spf')) {
    const match = header.value.match(/^\s*([^\s;(]+)/u)
    if (match) results.push({ source: header.name, method: 'spf', result: match[1].toLowerCase(), raw: header.value })
  }
  const summary: Record<string, string[]> = {}
  for (const result of results) {
    const statuses = summary[result.method] ?? []
    if (!statuses.includes(result.result)) statuses.push(result.result)
    summary[result.method] = statuses
  }
  return { summary, results, raw: rawHeaders.map((header) => `${header.name}: ${header.value}`) }
}

function addressDomain(value?: string): string | undefined {
  if (!value) return undefined
  const match = value.match(/@([^>\s,;]+)/u)
  return match?.[1].replace(/[)>]$/u, '').toLowerCase()
}

function values(headers: EmailHeader[], name: string): string[] {
  if (name === 'X-Mailer/User-Agent') return headers.filter((header) => ['x-mailer', 'user-agent'].includes(header.name.toLowerCase())).map((header) => decodeMimeWords(header.value))
  return headers.filter((header) => header.name.toLowerCase() === name.toLowerCase()).map((header) => ['from', 'to', 'cc', 'reply-to', 'subject'].includes(name.toLowerCase()) ? decodeMimeWords(header.value) : header.value)
}

export function parseEmailHeader(raw: string): EmailHeaderResult {
  const headers = parseHeaders(raw)
  const hops = parseReceived(headers)
  const first = (name: string) => values(headers, name)[0]
  const fromDomain = addressDomain(first('From'))
  const notes: IndicatorNote[] = []
  for (const comparison of ['Return-Path', 'Reply-To']) {
    const domain = addressDomain(first(comparison))
    if (fromDomain && domain && fromDomain !== domain && !notes.some((note) => note.domains[1] === domain)) notes.push({ kind: 'domain-mismatch', domains: [fromDomain, domain] })
  }
  const messageIdDomain = addressDomain(first('Message-ID'))
  if (messageIdDomain) notes.push({ kind: 'message-id-domain', domains: [messageIdDomain] })
  const timedHops = hops.filter((hop) => hop.timestamp)
  const totalTransitMs = timedHops.length >= 2 ? timedHops.at(-1)!.timestamp!.epochMs - timedHops[0].timestamp!.epochMs : undefined
  return { headers, fields: DISPLAY_FIELDS.map((name) => ({ name, values: values(headers, name) })).filter((field) => field.values.length), hops, totalTransitMs, authentication: parseAuthentication(headers), notes, iocs: extractIocs(raw) }
}
