export type ScriptName = 'Latin' | 'Cyrillic' | 'Greek' | 'Han' | 'Arabic' | 'Hebrew' | 'Common' | 'Inherited' | 'Unknown'

export interface CharacterInfo {
  character: string
  position: number
  utf16Offset: number
  codePoint: string
  category: string
  script: ScriptName
  ascii: boolean
}

export interface Finding {
  position: number
  utf16Offset: number
  codePoint: string
  character: string
  kind: 'zero-width' | 'bidi-control' | 'control' | 'format' | 'non-printing'
  name: string
}

export interface ConfusableFinding {
  position: number
  character: string
  codePoint: string
  resembles: string
  resemblesCodePoint: string
}

export interface DecodeResult { kind: 'escapes' | 'percent' | 'html' | 'punycode', value: string, changed: boolean, error?: string }

export interface UnicodeInspection {
  characters: CharacterInfo[]
  scripts: ScriptName[]
  mixedScript: boolean
  mixedScriptRuns: Array<{ script: ScriptName, start: number, end: number }>
  confusables: ConfusableFinding[]
  invisibles: Finding[]
  normalization: { nfc: string, nfcChanged: boolean, nfkc: string, nfkcChanged: boolean }
  decodes: DecodeResult[]
}

const SCRIPT_TESTS: Array<[ScriptName, RegExp]> = [
  ['Latin', /\p{Script=Latin}/u], ['Cyrillic', /\p{Script=Cyrillic}/u],
  ['Greek', /\p{Script=Greek}/u], ['Han', /\p{Script=Han}/u],
  ['Arabic', /\p{Script=Arabic}/u], ['Hebrew', /\p{Script=Hebrew}/u],
  ['Inherited', /\p{Script=Inherited}/u], ['Common', /\p{Script=Common}/u],
]

const CATEGORY_TESTS: Array<[string, RegExp]> = [
  ['Uppercase Letter (Lu)', /\p{Lu}/u], ['Lowercase Letter (Ll)', /\p{Ll}/u],
  ['Titlecase Letter (Lt)', /\p{Lt}/u], ['Modifier Letter (Lm)', /\p{Lm}/u],
  ['Other Letter (Lo)', /\p{Lo}/u], ['Nonspacing Mark (Mn)', /\p{Mn}/u],
  ['Spacing Mark (Mc)', /\p{Mc}/u], ['Enclosing Mark (Me)', /\p{Me}/u],
  ['Decimal Number (Nd)', /\p{Nd}/u], ['Letter Number (Nl)', /\p{Nl}/u],
  ['Other Number (No)', /\p{No}/u], ['Connector Punctuation (Pc)', /\p{Pc}/u],
  ['Dash Punctuation (Pd)', /\p{Pd}/u], ['Open Punctuation (Ps)', /\p{Ps}/u],
  ['Close Punctuation (Pe)', /\p{Pe}/u], ['Initial Punctuation (Pi)', /\p{Pi}/u],
  ['Final Punctuation (Pf)', /\p{Pf}/u], ['Other Punctuation (Po)', /\p{Po}/u],
  ['Math Symbol (Sm)', /\p{Sm}/u], ['Currency Symbol (Sc)', /\p{Sc}/u],
  ['Modifier Symbol (Sk)', /\p{Sk}/u], ['Other Symbol (So)', /\p{So}/u],
  ['Space Separator (Zs)', /\p{Zs}/u], ['Line Separator (Zl)', /\p{Zl}/u],
  ['Paragraph Separator (Zp)', /\p{Zp}/u], ['Control (Cc)', /\p{Cc}/u],
  ['Format (Cf)', /\p{Cf}/u], ['Surrogate (Cs)', /\p{Cs}/u],
  ['Private Use (Co)', /\p{Co}/u], ['Unassigned (Cn)', /\p{Cn}/u],
]

const CONTROL_NAMES = new Map<number, [Finding['kind'], string]>([
  [0x200b, ['zero-width', 'ZERO WIDTH SPACE']], [0x200c, ['zero-width', 'ZERO WIDTH NON-JOINER']],
  [0x200d, ['zero-width', 'ZERO WIDTH JOINER']], [0xfeff, ['zero-width', 'ZERO WIDTH NO-BREAK SPACE / BOM']],
  [0x061c, ['bidi-control', 'ARABIC LETTER MARK']], [0x200e, ['bidi-control', 'LEFT-TO-RIGHT MARK']],
  [0x200f, ['bidi-control', 'RIGHT-TO-LEFT MARK']], [0x202a, ['bidi-control', 'LEFT-TO-RIGHT EMBEDDING']],
  [0x202b, ['bidi-control', 'RIGHT-TO-LEFT EMBEDDING']], [0x202c, ['bidi-control', 'POP DIRECTIONAL FORMATTING']],
  [0x202d, ['bidi-control', 'LEFT-TO-RIGHT OVERRIDE']], [0x202e, ['bidi-control', 'RIGHT-TO-LEFT OVERRIDE']],
  [0x2066, ['bidi-control', 'LEFT-TO-RIGHT ISOLATE']], [0x2067, ['bidi-control', 'RIGHT-TO-LEFT ISOLATE']],
  [0x2068, ['bidi-control', 'FIRST STRONG ISOLATE']], [0x2069, ['bidi-control', 'POP DIRECTIONAL ISOLATE']],
])

const CONFUSABLES = new Map<string, string>([
  ['а', 'a'], ['А', 'A'], ['е', 'e'], ['Е', 'E'], ['о', 'o'], ['О', 'O'], ['р', 'p'], ['Р', 'P'],
  ['с', 'c'], ['С', 'C'], ['х', 'x'], ['Х', 'X'], ['у', 'y'], ['К', 'K'], ['М', 'M'], ['Т', 'T'],
  ['Β', 'B'], ['Ε', 'E'], ['Ζ', 'Z'], ['Η', 'H'], ['Ι', 'I'], ['Κ', 'K'], ['Μ', 'M'], ['Ν', 'N'],
  ['Ο', 'O'], ['Ρ', 'P'], ['Τ', 'T'], ['Χ', 'X'], ['ο', 'o'], ['ρ', 'p'], ['ν', 'v'],
])

function codePointLabel(character: string): string {
  return `U+${(character.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`
}

function scriptOf(character: string): ScriptName {
  return SCRIPT_TESTS.find(([, regex]) => regex.test(character))?.[0] ?? 'Unknown'
}

function categoryOf(character: string): string {
  return CATEGORY_TESTS.find(([, regex]) => regex.test(character))?.[0] ?? 'Unknown'
}

export function inspectCharacters(input: string): CharacterInfo[] {
  const result: CharacterInfo[] = []
  let utf16Offset = 0
  for (const [index, character] of Array.from(input).entries()) {
    result.push({ character, position: index + 1, utf16Offset, codePoint: codePointLabel(character), category: categoryOf(character), script: scriptOf(character), ascii: (character.codePointAt(0) ?? 0) <= 0x7f })
    utf16Offset += character.length
  }
  return result
}

function decodeEscapes(input: string): string {
  return input
    .replace(/\\u\{([0-9a-fA-F]{1,6})\}/gu, (match, hex: string) => { const cp = Number.parseInt(hex, 16); return cp <= 0x10ffff ? String.fromCodePoint(cp) : match })
    .replace(/\\u([0-9a-fA-F]{4})/gu, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/gu, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
}

function decodePercent(input: string): string {
  if (!/%[0-9a-fA-F]{2}/u.test(input)) return input
  return decodeURIComponent(input)
}

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' }
function decodeHtml(input: string): string {
  return input.replace(/&(?:#(\d+)|#x([0-9a-fA-F]+)|([a-zA-Z]+));/gu, (match, decimal: string | undefined, hex: string | undefined, named: string | undefined) => {
    const value = decimal ? Number.parseInt(decimal, 10) : hex ? Number.parseInt(hex, 16) : undefined
    if (value !== undefined) return value <= 0x10ffff ? String.fromCodePoint(value) : match
    return named && NAMED_ENTITIES[named] !== undefined ? NAMED_ENTITIES[named] : match
  })
}

function adaptBias(delta: number, points: number, first: boolean): number {
  delta = first ? Math.floor(delta / 700) : Math.floor(delta / 2)
  delta += Math.floor(delta / points)
  let k = 0
  while (delta > 455) { delta = Math.floor(delta / 35); k += 36 }
  return k + Math.floor((36 * delta) / (delta + 38))
}

function digitValue(character: string): number {
  const code = character.codePointAt(0) ?? 0
  if (code >= 0x30 && code <= 0x39) return code - 22
  if (code >= 0x41 && code <= 0x5a) return code - 65
  if (code >= 0x61 && code <= 0x7a) return code - 97
  throw new Error('Invalid Punycode digit')
}

export function decodePunycodeLabel(label: string): string {
  const encoded = label.toLowerCase().startsWith('xn--') ? label.slice(4) : label
  const output: number[] = []
  const delimiter = encoded.lastIndexOf('-')
  let cursor = 0
  if (delimiter >= 0) {
    for (const character of encoded.slice(0, delimiter)) {
      if ((character.codePointAt(0) ?? 128) >= 128) throw new Error('Non-ASCII basic code point')
      output.push(character.codePointAt(0) ?? 0)
    }
    cursor = delimiter + 1
  }
  let n = 128; let i = 0; let bias = 72
  while (cursor < encoded.length) {
    const oldI = i
    let weight = 1
    for (let k = 36; ; k += 36) {
      if (cursor >= encoded.length) throw new Error('Truncated Punycode input')
      const digit = digitValue(encoded[cursor++])
      if (digit > Math.floor((Number.MAX_SAFE_INTEGER - i) / weight)) throw new Error('Punycode overflow')
      i += digit * weight
      const threshold = k <= bias ? 1 : k >= bias + 26 ? 26 : k - bias
      if (digit < threshold) break
      const factor = 36 - threshold
      if (weight > Math.floor(Number.MAX_SAFE_INTEGER / factor)) throw new Error('Punycode overflow')
      weight *= factor
    }
    const length = output.length + 1
    bias = adaptBias(i - oldI, length, oldI === 0)
    n += Math.floor(i / length)
    i %= length
    if (n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) throw new Error('Invalid Unicode code point')
    output.splice(i, 0, n)
    i += 1
  }
  return String.fromCodePoint(...output)
}

export function decodePunycodeHostname(input: string): string {
  return input.split('.').map((label) => label.toLowerCase().startsWith('xn--') ? decodePunycodeLabel(label) : label).join('.')
}

function decodeStep(kind: DecodeResult['kind'], input: string, decoder: (value: string) => string): DecodeResult {
  try { const value = decoder(input); return { kind, value, changed: value !== input } }
  catch (error) { return { kind, value: input, changed: false, error: error instanceof Error ? error.message : 'Decode failed' } }
}

export function inspectUnicode(input: string): UnicodeInspection {
  const characters = inspectCharacters(input)
  const significantScripts = [...new Set(characters.map((item) => item.script).filter((script) => !['Common', 'Inherited', 'Unknown'].includes(script)))]
  const scripts = [...new Set(characters.map((item) => item.script))]
  const runs: UnicodeInspection['mixedScriptRuns'] = []
  for (const item of characters) {
    if (['Common', 'Inherited', 'Unknown'].includes(item.script)) continue
    const previous = runs.at(-1)
    if (previous?.script === item.script) previous.end = item.position
    else runs.push({ script: item.script, start: item.position, end: item.position })
  }
  const invisibles: Finding[] = []
  for (const item of characters) {
    const cp = item.character.codePointAt(0) ?? 0
    const known = CONTROL_NAMES.get(cp)
    const fallbackKind = /\p{Cc}/u.test(item.character) ? 'control' : /\p{Cf}/u.test(item.character) ? 'format' : /[\p{Zl}\p{Zp}]/u.test(item.character) ? 'non-printing' : undefined
    if (known || fallbackKind) invisibles.push({ position: item.position, utf16Offset: item.utf16Offset, codePoint: item.codePoint, character: item.character, kind: known?.[0] ?? fallbackKind!, name: known?.[1] ?? item.category })
  }
  const confusables = characters.flatMap((item): ConfusableFinding[] => {
    const resembles = CONFUSABLES.get(item.character)
    return resembles ? [{ position: item.position, character: item.character, codePoint: item.codePoint, resembles, resemblesCodePoint: codePointLabel(resembles) }] : []
  })
  const nfc = input.normalize('NFC'); const nfkc = input.normalize('NFKC')
  return {
    characters, scripts, mixedScript: significantScripts.length > 1, mixedScriptRuns: runs, confusables, invisibles,
    normalization: { nfc, nfcChanged: nfc !== input, nfkc, nfkcChanged: nfkc !== input },
    decodes: [decodeStep('escapes', input, decodeEscapes), decodeStep('percent', input, decodePercent), decodeStep('html', input, decodeHtml), decodeStep('punycode', input, decodePunycodeHostname)],
  }
}
