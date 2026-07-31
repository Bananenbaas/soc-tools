export interface JwtTimestamp { raw: number; utc: string; amsterdam: string }
export interface InspectedJwt { header: unknown; payload: unknown; timestamps: Partial<Record<'exp' | 'iat' | 'nbf', JwtTimestamp>> }

function decodeSegment(segment: string): unknown {
  if (!/^[A-Za-z0-9_-]+$/u.test(segment)) throw new Error('Invalid Base64URL segment')
  const standard = segment.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(segment.length / 4) * 4, '=')
  let binary: string
  try { binary = atob(standard) } catch { throw new Error('Invalid Base64URL segment') }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  let text: string
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { throw new Error('Invalid UTF-8 segment') }
  try { return JSON.parse(text) as unknown } catch { throw new Error('Segment is not valid JSON') }
}

function formatTime(raw: number, zone: string): string {
  const date = new Date(raw * 1000)
  if (!Number.isFinite(raw) || Number.isNaN(date.getTime())) throw new Error('Invalid JWT timestamp')
  return new Intl.DateTimeFormat('en-GB', { timeZone: zone, dateStyle: 'medium', timeStyle: 'long', hour12: false }).format(date)
}

export function inspectJwt(token: string): InspectedJwt {
  const parts = token.trim().split('.')
  if (parts.length !== 3 || parts.some((part) => !part)) throw new Error('JWT must contain three segments')
  const header = decodeSegment(parts[0])
  const payload = decodeSegment(parts[1])
  if (typeof header !== 'object' || header === null || Array.isArray(header) || typeof payload !== 'object' || payload === null || Array.isArray(payload)) throw new Error('Header and payload must be JSON objects')
  const timestamps: InspectedJwt['timestamps'] = {}
  for (const claim of ['exp', 'iat', 'nbf'] as const) {
    const raw = (payload as Record<string, unknown>)[claim]
    if (raw !== undefined) {
      if (typeof raw !== 'number') throw new Error(`Invalid ${claim} timestamp`)
      timestamps[claim] = { raw, utc: formatTime(raw, 'UTC'), amsterdam: formatTime(raw, 'Europe/Amsterdam') }
    }
  }
  return { header, payload, timestamps }
}

export function formatJwtInspection(value: InspectedJwt): string {
  const sections = [`HEADER\n${JSON.stringify(value.header, null, 2)}`, `PAYLOAD\n${JSON.stringify(value.payload, null, 2)}`]
  const times = Object.entries(value.timestamps).map(([claim, time]) => `${claim}: ${time.raw}\n  UTC: ${time.utc}\n  Europe/Amsterdam: ${time.amsterdam}`)
  if (times.length) sections.push(`TIMESTAMPS\n${times.join('\n')}`)
  return sections.join('\n\n')
}
