export type DeobfuscationStep = 'base64' | 'hex' | 'escapes' | 'fromCharCode' | 'concatenation' | 'atob' | 'dean-edwards'

export interface DeobfuscationResult {
  output: string
  steps: DeobfuscationStep[]
  requiresSandbox: boolean
}

const MAX_PASSES = 12

function decodeBase64(value: string): string | undefined {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value) || value.length < 4) return
  try {
    const bytes = Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return
  }
}

function decodeQuotedBody(value: string): string {
  return value.replace(/\\x([\da-f]{2})|\\u\{([\da-f]{1,6})\}|\\u([\da-f]{4})|\\u([\da-f]{2})(?![\da-f])|\\([\\'"bfnrtv0])/giu,
    (_match, hex: string | undefined, braced: string | undefined, unicode: string | undefined, short: string | undefined, escaped: string | undefined) => {
      if (hex) return String.fromCharCode(Number.parseInt(hex, 16))
      if (braced) return String.fromCodePoint(Number.parseInt(braced, 16))
      if (unicode) return String.fromCharCode(Number.parseInt(unicode, 16))
      if (short) return String.fromCharCode(Number.parseInt(short, 16))
      const simple: Record<string, string> = { b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v', '0': '\0' }
      return escaped === undefined ? '' : (simple[escaped] ?? escaped)
    })
}

function encodeQuoted(value: string, quote: string): string {
  return `${quote}${value.replaceAll('\\', '\\\\').replaceAll(quote, `\\${quote}`).replaceAll('\n', '\\n').replaceAll('\r', '\\r')}${quote}`
}

function unpackDeanEdwards(source: string): string | undefined {
  if (!/^\s*eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*d\s*\)/u.test(source)) return
  const invocation = /\}\s*\(\s*(['"])((?:\\.|(?!\1)[\s\S])*)\1\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(['"])((?:\\.|(?!\5)[\s\S])*)\5\.split\(\s*(['"])\|\7\s*\)/u.exec(source)
  if (!invocation) return
  const payload = decodeQuotedBody(invocation[2])
  const radix = Number(invocation[3])
  const count = Number(invocation[4])
  const keywords = decodeQuotedBody(invocation[6]).split('|')
  if (radix < 2 || radix > 36 || count < 0 || count > 100_000 || keywords.length < count) return
  return payload.replace(/\b[\da-z]+\b/giu, (word) => {
    const index = Number.parseInt(word, radix)
    return Number.isSafeInteger(index) && index < count && keywords[index] ? keywords[index] : word
  })
}

function transformOnce(source: string): { output: string; step?: DeobfuscationStep } {
  const packed = unpackDeanEdwards(source)
  if (packed !== undefined && packed !== source) return { output: packed, step: 'dean-edwards' }

  const trimmed = source.trim()
  const base64 = decodeBase64(trimmed)
  if (base64 !== undefined && base64 !== source) return { output: base64, step: 'base64' }
  if (/^(?:[\da-f]{2}\s*){2,}$/iu.test(trimmed)) {
    const hex = trimmed.replace(/\s/gu, '')
    const bytes = Uint8Array.from(hex.match(/../gu) ?? [], (pair) => Number.parseInt(pair, 16))
    try {
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      if (decoded !== source) return { output: decoded, step: 'hex' }
    } catch { /* Geen transformatie: niet iedere byte-reeks is tekst. */ }
  }

  let changed = false
  let output = source.replace(/\batob\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*\)/gu, (match, quote: string, body: string) => {
    const decoded = decodeBase64(decodeQuotedBody(body))
    if (decoded === undefined) return match
    changed = true
    return encodeQuoted(decoded, quote)
  })
  if (changed) return { output, step: 'atob' }

  output = source.replace(/\bString\.fromCharCode\(\s*((?:0x[\da-f]+|\d+)(?:\s*,\s*(?:0x[\da-f]+|\d+))*)\s*\)/giu, (_match, list: string) => {
    const values = list.split(',').map((part) => Number(part.trim()))
    if (values.some((value) => !Number.isInteger(value) || value < 0 || value > 0xffff)) return _match
    changed = true
    return encodeQuoted(String.fromCharCode(...values), "'")
  })
  if (changed) return { output, step: 'fromCharCode' }

  output = source.replace(/(['"])((?:\\.|(?!\1)[^\r\n])*)\1\s*\+\s*(['"])((?:\\.|(?!\3)[^\r\n])*)\3/gu,
    (_match, quote: string, left: string, _rightQuote: string, right: string) => {
      changed = true
      return encodeQuoted(decodeQuotedBody(left) + decodeQuotedBody(right), quote)
    })
  if (changed) return { output, step: 'concatenation' }

  output = source.replace(/\\x[\da-f]{2}|\\u\{[\da-f]{1,6}\}|\\u[\da-f]{4}|\\u[\da-f]{2}(?![\da-f])/giu, (escape) => decodeQuotedBody(escape))
  if (output !== source) return { output, step: 'escapes' }
  return { output: source }
}

export function deobfuscateStatic(input: string): DeobfuscationResult {
  let output = input
  const steps: DeobfuscationStep[] = []
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const transformed = transformOnce(output)
    if (!transformed.step || transformed.output === output) break
    output = transformed.output
    steps.push(transformed.step)
  }
  const compact = output.replace(/\s/gu, '')
  const isJsFuck = compact.length > 0 && /^(?:\[|\]|\(|\)|!|\+)+$/u.test(compact)
  const dynamicCode = /\b(?:eval|Function)\s*\(|\[['"](?:constructor|filter)['"]\]/u.test(output)
  return { output, steps, requiresSandbox: isJsFuck || dynamicCode }
}
