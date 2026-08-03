export type TimestampInputType = 'seconds' | 'milliseconds' | 'filetime' | 'human'
const FILETIME_EPOCH_OFFSET_MS = 11_644_473_600_000n

function validateEpochMs(value: number): number {
  if (!Number.isFinite(value) || Number.isNaN(new Date(value).getTime())) throw new Error('Timestamp is outside the supported date range')
  return value
}

export function parseTimestamp(value: string, type: TimestampInputType): number {
  const input = value.trim()
  if (!input) throw new Error('Enter a timestamp')
  if (type === 'human') {
    const parsed = Date.parse(input)
    if (Number.isNaN(parsed)) throw new Error('Invalid human date-time')
    return validateEpochMs(parsed)
  }
  if (!(type === 'filetime' ? /^\d+$/u.test(input) : /^-?\d+$/u.test(input))) throw new Error('Timestamp must be an integer')
  if (type === 'filetime') {
    const ticks = BigInt(input)
    const milliseconds = ticks / 10_000n - FILETIME_EPOCH_OFFSET_MS
    const numeric = Number(milliseconds)
    if (!Number.isSafeInteger(numeric)) throw new Error('FILETIME is outside the supported date range')
    return validateEpochMs(numeric)
  }
  const numeric = Number(input)
  if (!Number.isSafeInteger(numeric)) throw new Error('Timestamp is outside the safe integer range')
  return validateEpochMs(type === 'seconds' ? numeric * 1000 : numeric)
}

function inZone(epochMs: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, dateStyle: 'full', timeStyle: 'long', hour12: false }).format(new Date(epochMs))
}

export interface TimestampConversions { seconds: string; milliseconds: string; filetime: string; iso: string; utc: string; amsterdam: string }

export function convertTimestamp(epochMs: number): TimestampConversions {
  validateEpochMs(epochMs)
  const milliseconds = BigInt(Math.trunc(epochMs))
  return {
    seconds: String(Math.trunc(epochMs / 1000)),
    milliseconds: String(Math.trunc(epochMs)),
    filetime: String((milliseconds + FILETIME_EPOCH_OFFSET_MS) * 10_000n),
    iso: new Date(epochMs).toISOString(),
    utc: inZone(epochMs, 'UTC'),
    amsterdam: inZone(epochMs, 'Europe/Amsterdam'),
  }
}

export function formatTimestampConversions(value: TimestampConversions): string {
  return `Unix seconds: ${value.seconds}\nUnix milliseconds: ${value.milliseconds}\nWindows FILETIME: ${value.filetime}\nISO 8601: ${value.iso}\nUTC: ${value.utc}\nEurope/Amsterdam: ${value.amsterdam}`
}
