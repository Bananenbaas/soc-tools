import { extractIocs, type IocResult } from '../ioc/ioc'
import { decodePowerShellEncodedCommand } from '../psdecoder/psdecoder'

export type InterpreterFlagKind = 'powershell' | 'cmd'

export interface InterpreterFlag {
  kind: InterpreterFlagKind
  flag: string
  value?: string
  explanation: string
}

export interface InformativeHint {
  name: string
  reason: string
}

export interface EncodedFragment {
  value: string
  reason: string
}

export interface CmdLineAnalysis {
  executable: string
  arguments: string[]
  tokens: string[]
  tokenization: 'best-effort'
  environmentVariables: string[]
  flags: InterpreterFlag[]
  decodedScript?: string
  decodeError?: string
  lolbinHints: InformativeHint[]
  indicators: IocResult
  encodedFragments: EncodedFragment[]
  parentChildHints: InformativeHint[]
}

interface LolbinDefinition {
  names: string[]
  reason: string
  argumentPattern?: RegExp
}

const LOLBINS: LolbinDefinition[] = [
  { names: ['rundll32.exe', 'rundll32'], reason: 'rundll32' },
  { names: ['regsvr32.exe', 'regsvr32'], reason: 'regsvr32' },
  { names: ['mshta.exe', 'mshta'], reason: 'mshta' },
  { names: ['certutil.exe', 'certutil'], reason: 'certutil' },
  { names: ['bitsadmin.exe', 'bitsadmin'], reason: 'bitsadmin' },
  { names: ['wmic.exe', 'wmic'], reason: 'wmic' },
  { names: ['msbuild.exe', 'msbuild'], reason: 'msbuild' },
  { names: ['installutil.exe', 'installutil'], reason: 'installutil' },
  { names: ['cscript.exe', 'cscript'], reason: 'scriptHost' },
  { names: ['wscript.exe', 'wscript'], reason: 'scriptHost' },
  { names: ['forfiles.exe', 'forfiles'], reason: 'forfiles' },
  { names: ['hh.exe', 'hh'], reason: 'hh' },
  { names: ['reg.exe', 'reg'], reason: 'reg', argumentPattern: /(?:^|\s)(?:add|delete|import|save)(?:\s|$)/iu },
]

const POWERSHELL_FLAGS: Record<string, { explanation: string, takesValue?: boolean }> = {
  nop: { explanation: 'noProfile' }, noprofile: { explanation: 'noProfile' },
  w: { explanation: 'windowStyle', takesValue: true }, windowstyle: { explanation: 'windowStyle', takesValue: true },
  ep: { explanation: 'executionPolicy', takesValue: true }, executionpolicy: { explanation: 'executionPolicy', takesValue: true },
  enc: { explanation: 'encodedCommand', takesValue: true }, encodedcommand: { explanation: 'encodedCommand', takesValue: true },
  ec: { explanation: 'encodedCommand', takesValue: true }, e: { explanation: 'encodedCommand', takesValue: true },
  c: { explanation: 'command', takesValue: true }, command: { explanation: 'command', takesValue: true },
  noni: { explanation: 'nonInteractive' }, noninteractive: { explanation: 'nonInteractive' },
  nologo: { explanation: 'noLogo' }, sta: { explanation: 'sta' }, mta: { explanation: 'mta' },
  file: { explanation: 'file', takesValue: true }, f: { explanation: 'file', takesValue: true },
}

const PARENT_CHILD_PAIRS = new Map<string, string>([
  ['winword.exe>powershell.exe', 'officeInterpreter'], ['winword.exe>pwsh.exe', 'officeInterpreter'],
  ['excel.exe>powershell.exe', 'officeInterpreter'], ['excel.exe>cmd.exe', 'officeShell'],
  ['powerpnt.exe>powershell.exe', 'officeInterpreter'], ['outlook.exe>cmd.exe', 'mailShell'],
  ['outlook.exe>powershell.exe', 'mailShell'], ['mshta.exe>powershell.exe', 'scriptInterpreter'],
  ['wscript.exe>cmd.exe', 'scriptShell'], ['cscript.exe>powershell.exe', 'scriptInterpreter'],
])

function basename(value: string): string {
  return value.trim().replace(/^['"]|['"]$/gu, '').split(/[\\/]/u).at(-1)?.toLowerCase() ?? ''
}

export function tokenizeWindowsCommandLine(input: string): string[] {
  const tokens: string[] = []
  let token = ''
  let quoted = false
  let started = false
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]
    if ((character === '^' || character === '`') && index + 1 < input.length) {
      token += input[index + 1]
      started = true
      index += 1
    } else if (character === '\\' && input[index + 1] === '"') {
      token += '"'
      started = true
      index += 1
    } else if (character === '"') {
      quoted = !quoted
      started = true
    } else if (/\s/u.test(character) && !quoted) {
      if (started) tokens.push(token)
      token = ''
      started = false
    } else {
      token += character
      started = true
    }
  }
  if (started) tokens.push(token)
  return tokens
}

function findEnvironmentVariables(commandLine: string): string[] {
  const found = new Map<string, string>()
  for (const match of commandLine.matchAll(/%([A-Za-z_][A-Za-z0-9_]*)%/gu)) found.set(match[1].toLowerCase(), `%${match[1]}%`)
  for (const match of commandLine.matchAll(/\$env:([A-Za-z_][A-Za-z0-9_]*)/giu)) found.set(match[1].toLowerCase(), `$env:${match[1]}`)
  return [...found.values()]
}

function recognizeFlags(executable: string, args: string[]): InterpreterFlag[] {
  const name = basename(executable)
  if (['cmd', 'cmd.exe'].includes(name)) {
    return args.filter((argument) => /^\/[ck]$/iu.test(argument)).map((flag) => ({ kind: 'cmd', flag, explanation: flag.toLowerCase() === '/c' ? 'cmdRunClose' : 'cmdRunKeep' }))
  }
  if (!['powershell', 'powershell.exe', 'pwsh', 'pwsh.exe'].includes(name)) return []
  const flags: InterpreterFlag[] = []
  for (let index = 0; index < args.length; index += 1) {
    const match = /^[-/]([^:=\s]+)(?::|=)?(.*)$/u.exec(args[index])
    if (!match) continue
    const definition = POWERSHELL_FLAGS[match[1].toLowerCase()]
    if (!definition) continue
    const inlineValue = match[2]
    const value = definition.takesValue ? (inlineValue || args[index + 1]) : undefined
    flags.push({ kind: 'powershell', flag: args[index], value, explanation: definition.explanation })
  }
  return flags
}

function recognizeEncodedFragments(tokens: string[], encodedCommand?: string): EncodedFragment[] {
  const results: EncodedFragment[] = []
  for (const token of tokens) {
    const value = token.replace(/^['"]|['"]$/gu, '')
    if (value === encodedCommand || value.length < 20 || value.length % 4 !== 0) continue
    if (/^[A-Za-z0-9+/]+={0,2}$/u.test(value) && /[A-Za-z]/u.test(value)) results.push({ value, reason: 'base64Shape' })
  }
  return results
}

function recognizeParentChild(parent: string, executable: string): InformativeHint[] {
  if (!parent.trim()) return []
  const parentName = basename(tokenizeWindowsCommandLine(parent)[0] ?? parent)
  const childName = basename(executable)
  const reason = PARENT_CHILD_PAIRS.get(`${parentName}>${childName}`)
  return reason ? [{ name: `${parentName} → ${childName}`, reason }] : []
}

export function analyzeCommandLine(commandLine: string, parentProcess = ''): CmdLineAnalysis {
  const tokens = tokenizeWindowsCommandLine(commandLine.trim())
  const executable = tokens[0] ?? ''
  const argumentsList = tokens.slice(1)
  const flags = recognizeFlags(executable, argumentsList)
  const executableName = basename(executable)
  const argumentText = argumentsList.join(' ')
  const lolbinHints = LOLBINS
    .filter((definition) => definition.names.includes(executableName) && (!definition.argumentPattern || definition.argumentPattern.test(argumentText)))
    .map((definition) => ({ name: executableName, reason: definition.reason }))

  let decodedScript: string | undefined
  let decodeError: string | undefined
  const encodedFlag = flags.find((flag) => flag.explanation === 'encodedCommand')
  if (encodedFlag) {
    try {
      decodedScript = decodePowerShellEncodedCommand(commandLine).decoded
    } catch (cause) {
      decodeError = cause instanceof Error ? cause.message : 'Decode failed'
    }
  }

  return {
    executable, arguments: argumentsList, tokens, tokenization: 'best-effort',
    environmentVariables: findEnvironmentVariables(commandLine), flags, decodedScript, decodeError,
    lolbinHints, indicators: extractIocs(commandLine),
    encodedFragments: recognizeEncodedFragments(tokens, encodedFlag?.value),
    parentChildHints: recognizeParentChild(parentProcess, executable),
  }
}
