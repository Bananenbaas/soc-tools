import { decodeBase64Bytes } from '../base64/base64'

export type JsonIndent = 2 | 4 | '\t'
export type JsonMode = 'format' | 'minify' | 'sort' | 'flatten' | 'escape' | 'unescape'
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

export interface JsonLocationError {
  message: string
  line: number
  column: number
  position: number
  excerpt: string
}

export interface JsonStats {
  bytes: number
  maxDepth: number
  totalKeys: number
  arrays: number
  objects: number
  scalars: number
}

export interface EmbeddedDecode {
  path: string
  kind: 'Base64' | 'JWT'
  preview: string
}

export interface InspectionResult {
  output: string
  valid: boolean
  error?: JsonLocationError
  recordCount: number
  isJsonLines: boolean
  stats?: JsonStats
  notes: EmbeddedDecode[]
}

function indentValue(indent: JsonIndent): number | string {
  return indent === '\t' ? '\t' : indent
}

function positionFromMessage(message: string, input: string): number {
  const position = /(?:position|at position)\s+(\d+)/iu.exec(message)?.[1]
  if (position !== undefined) return Math.min(Number(position), input.length)
  const location = /line\s+(\d+)\s+column\s+(\d+)/iu.exec(message)
  if (location) {
    const targetLine = Number(location[1])
    const targetColumn = Number(location[2])
    let offset = 0
    for (let line = 1; line < targetLine; line += 1) offset = input.indexOf('\n', offset) + 1
    return Math.min(offset + targetColumn - 1, input.length)
  }
  const missingValue = /:\s*([}\]])/gu.exec(input)
  if (missingValue?.index !== undefined && missingValue[1]) return missingValue.index + missingValue[0].lastIndexOf(missingValue[1])
  return input.length
}

export function locateJsonError(input: string, cause: unknown): JsonLocationError {
  const rawMessage = cause instanceof Error ? cause.message : String(cause)
  const position = positionFromMessage(rawMessage, input)
  const before = input.slice(0, position)
  const line = before.split('\n').length
  const lineStart = before.lastIndexOf('\n') + 1
  const column = position - lineStart + 1
  const excerptStart = Math.max(lineStart, position - 24)
  const lineEnd = input.indexOf('\n', position)
  const excerptEnd = Math.min(lineEnd < 0 ? input.length : lineEnd, position + 24)
  return { message: rawMessage.replace(/^JSON\.parse:\s*/u, ''), line, column, position, excerpt: input.slice(excerptStart, excerptEnd) }
}

function parseJsonLines(input: string): JsonValue[] | undefined {
  const lines = input.split(/\r?\n/u).filter((line) => line.trim())
  if (lines.length < 2) return undefined
  try {
    return lines.map((line) => JSON.parse(line) as JsonValue)
  } catch {
    return undefined
  }
}

export function parseJsonInput(input: string): { values: JsonValue[], isJsonLines: boolean } {
  try {
    return { values: [JSON.parse(input) as JsonValue], isJsonLines: false }
  } catch (singleError) {
    const values = parseJsonLines(input)
    if (values) return { values, isJsonLines: true }
    throw singleError
  }
}

export function sortJsonKeys(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(sortJsonKeys)
  if (value !== null && typeof value === 'object') {
    const sorted: { [key: string]: JsonValue } = {}
    for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) sorted[key] = sortJsonKeys(value[key] as JsonValue)
    return sorted
  }
  return value
}

function pathSegment(key: string): string {
  return /^[A-Za-z_$][\w$]*$/u.test(key) ? key : `[${JSON.stringify(key)}]`
}

function joinPath(path: string, key: string): string {
  const segment = pathSegment(key)
  return segment.startsWith('[') ? `${path}${segment}` : path ? `${path}.${segment}` : segment
}

export function flattenJson(value: JsonValue): string {
  const rows: string[] = []
  function visit(current: JsonValue, path: string) {
    if (Array.isArray(current)) {
      if (!current.length) rows.push(`${path || '$'} = []`)
      else current.forEach((item, index) => visit(item, `${path}[${index}]`))
    } else if (current !== null && typeof current === 'object') {
      const entries = Object.entries(current)
      if (!entries.length) rows.push(`${path || '$'} = {}`)
      else entries.forEach(([key, item]) => visit(item, joinPath(path, key)))
    } else {
      rows.push(`${path || '$'} = ${JSON.stringify(current)}`)
    }
  }
  visit(value, '')
  return rows.join('\n')
}

export function escapeJsonString(input: string): string {
  return JSON.stringify(input)
}

export function unescapeJsonString(input: string): string {
  const value: unknown = JSON.parse(input)
  if (typeof value !== 'string') throw new Error('Input must be a JSON string literal')
  return value
}

export function calculateJsonStats(values: JsonValue[], input: string): JsonStats {
  const stats: JsonStats = { bytes: new TextEncoder().encode(input).byteLength, maxDepth: 0, totalKeys: 0, arrays: 0, objects: 0, scalars: 0 }
  function visit(value: JsonValue, depth: number) {
    stats.maxDepth = Math.max(stats.maxDepth, depth)
    if (Array.isArray(value)) {
      stats.arrays += 1
      value.forEach((item) => visit(item, depth + 1))
    } else if (value !== null && typeof value === 'object') {
      stats.objects += 1
      const entries = Object.entries(value)
      stats.totalKeys += entries.length
      entries.forEach(([, item]) => visit(item, depth + 1))
    } else stats.scalars += 1
  }
  values.forEach((value) => visit(value, 1))
  return stats
}

function printablePreview(bytes: Uint8Array): string | undefined {
  let decoded: string
  try { decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { return undefined }
  if (!decoded || [...decoded].some((character) => { const code = character.codePointAt(0) ?? 0; return code < 0x20 && !'\r\n\t'.includes(character) })) return undefined
  return decoded.length > 240 ? `${decoded.slice(0, 240)}…` : decoded
}

function decodeJwtPart(part: string): JsonValue {
  const text = printablePreview(decodeBase64Bytes(part, 'base64url'))
  if (text === undefined) throw new Error('Invalid UTF-8')
  return JSON.parse(text) as JsonValue
}

export function findEmbeddedDecodes(values: JsonValue[]): EmbeddedDecode[] {
  const notes: EmbeddedDecode[] = []
  function visit(value: JsonValue, path: string) {
    if (typeof value === 'string') {
      const jwt = /^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]*)$/u.exec(value)
      if (jwt) {
        try {
          const header = decodeJwtPart(jwt[1] as string)
          const payload = decodeJwtPart(jwt[2] as string)
          notes.push({ path: path || '$', kind: 'JWT', preview: `header: ${JSON.stringify(header)}\npayload: ${JSON.stringify(payload)}` })
          return
        } catch { /* Geen notitie wanneer een JWT-vorm niet decodeerbaar is. */ }
      }
      if (value.length >= 16 && value.length <= 65_536 && /^(?:[A-Za-z0-9+/]{4})+(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) {
        try {
          const preview = printablePreview(decodeBase64Bytes(value))
          if (preview !== undefined) notes.push({ path: path || '$', kind: 'Base64', preview })
        } catch { /* Vormherkenning blijft best effort. */ }
      }
    } else if (Array.isArray(value)) value.forEach((item, index) => visit(item, `${path}[${index}]`))
    else if (value !== null && typeof value === 'object') Object.entries(value).forEach(([key, item]) => visit(item, joinPath(path, key)))
  }
  values.forEach((value, index) => visit(value, values.length > 1 ? `$[${index}]` : ''))
  return notes
}

export function inspectJson(input: string, mode: JsonMode = 'format', indent: JsonIndent = 2): InspectionResult {
  if (mode === 'escape') return { output: escapeJsonString(input), valid: true, recordCount: 0, isJsonLines: false, notes: [] }
  if (mode === 'unescape') {
    try { return { output: unescapeJsonString(input), valid: true, recordCount: 1, isJsonLines: false, notes: [] } }
    catch (error) { return { output: '', valid: false, error: locateJsonError(input, error), recordCount: 0, isJsonLines: false, notes: [] } }
  }
  try {
    const parsed = parseJsonInput(input)
    const values = mode === 'sort' ? parsed.values.map(sortJsonKeys) : parsed.values
    const space = mode === 'minify' ? undefined : indentValue(indent)
    const output = mode === 'flatten'
      ? values.map(flattenJson).join(parsed.isJsonLines ? '\n' : '')
      : values.map((value) => JSON.stringify(value, null, space)).join(parsed.isJsonLines ? '\n' : '')
    return { output, valid: true, recordCount: values.length, isJsonLines: parsed.isJsonLines, stats: calculateJsonStats(parsed.values, input), notes: findEmbeddedDecodes(parsed.values) }
  } catch (error) {
    return { output: '', valid: false, error: locateJsonError(input, error), recordCount: 0, isJsonLines: false, notes: [] }
  }
}
