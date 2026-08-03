import { extractIocs } from '../ioc/ioc'

export type ConditionOperator = 'equals' | 'not_equals' | 'contains' | 'in'

export interface QuerySpec {
  dataSource?: string
  conditions: Array<{ field: string, op: ConditionOperator, value: string | string[] }>
  combinator: 'AND' | 'OR'
  timeWindow?: { kind: 'relative', last: string } | { kind: 'absolute', fromISO: string, toISO: string }
}

export interface Dialect { id: string, name: string, generate: (spec: QuerySpec) => string }

const quote = (value: string) => `"${value.replace(/\\/gu, '\\\\').replace(/"/gu, '\\"')}"`
const regexEscape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
const shellQuote = (value: string) => `'${value.replace(/'/gu, `'\\''`)}'`
const values = (condition: QuerySpec['conditions'][number]) => Array.isArray(condition.value) ? condition.value : [condition.value]
const joiner = (spec: QuerySpec, lower = false) => lower ? ` ${spec.combinator.toLowerCase()} ` : ` ${spec.combinator} `
const safeIdentifier = (value: string | undefined, fallback: string) => value && /^[A-Za-z_][A-Za-z0-9_.@-]*$/u.test(value.trim()) ? value.trim() : fallback
const safeTime = (value: string) => /^[0-9TtZz:+.\-/ ]+$/u.test(value) ? value : '__UNSAFE_TIME__'

function relative(last: string): string {
  const clean = last.trim().replace(/^-+/u, '')
  return /^\d+(?:ms|s|m|h|d|w)$/iu.test(clean) ? clean : '24h'
}

function splCondition(condition: QuerySpec['conditions'][number]): string {
  const list = values(condition)
  const field = safeIdentifier(condition.field, '__UNSAFE_FIELD__')
  if (condition.op === 'in') return `${field} IN (${list.map(quote).join(',')})`
  if (condition.op === 'contains') return `${field}=${quote(`*${list[0]}*`)}`
  return `${field}${condition.op === 'not_equals' ? '!=' : '='}${quote(list[0])}`
}

function kqlCondition(condition: QuerySpec['conditions'][number]): string {
  const list = values(condition)
  const field = safeIdentifier(condition.field, '__UNSAFE_FIELD__')
  if (condition.op === 'in') return `${field} in (${list.map(quote).join(',')})`
  if (condition.op === 'contains') return `${field} contains ${quote(list[0])}`
  return `${field} ${condition.op === 'not_equals' ? '!=' : '=='} ${quote(list[0])}`
}

function elasticCondition(condition: QuerySpec['conditions'][number], lucene = false): string {
  const list = values(condition)
  const separator = lucene ? ' OR ' : ' or '
  const expression = list.length > 1 || condition.op === 'in' ? `(${list.map(quote).join(separator)})` : quote(condition.op === 'contains' ? `*${list[0]}*` : list[0])
  const field = safeIdentifier(condition.field, '__UNSAFE_FIELD__')
  return condition.op === 'not_equals' ? `NOT ${field}:${expression}` : `${field}${lucene ? ':' : ' : '}${expression}`
}

function eqlCondition(condition: QuerySpec['conditions'][number]): string {
  const list = values(condition)
  const field = safeIdentifier(condition.field, '__UNSAFE_FIELD__')
  if (condition.op === 'in') return `${field} in (${list.map(quote).join(',')})`
  if (condition.op === 'contains') return `${field} : ${quote(`*${list[0]}*`)}`
  return `${field} ${condition.op === 'not_equals' ? '!=' : '=='} ${quote(list[0])}`
}

function iso(value: string): string { return quote(value) }

export const dialects: Dialect[] = [
  { id: 'splunk', name: 'Splunk SPL', generate: (spec) => [spec.dataSource ? `index=${safeIdentifier(spec.dataSource, '__UNSAFE_DATASOURCE__')}` : '', spec.conditions.map(splCondition).join(joiner(spec)), spec.timeWindow?.kind === 'relative' ? `earliest=-${relative(spec.timeWindow.last)}` : spec.timeWindow ? `earliest=${iso(safeTime(spec.timeWindow.fromISO))} latest=${iso(safeTime(spec.timeWindow.toISO))}` : ''].filter(Boolean).join(' ') },
  { id: 'kusto', name: 'Microsoft Kusto KQL', generate: (spec) => `${safeIdentifier(spec.dataSource, 'TableName')}${spec.conditions.length ? ` | where ${spec.conditions.map(kqlCondition).join(joiner(spec, true))}` : ''}${spec.timeWindow?.kind === 'relative' ? ` | where Timestamp > ago(${relative(spec.timeWindow.last)})` : spec.timeWindow ? ` | where Timestamp between (datetime(${safeTime(spec.timeWindow.fromISO)}) .. datetime(${safeTime(spec.timeWindow.toISO)}))` : ''}` },
  { id: 'elastic-kql', name: 'Elastic KQL', generate: (spec) => `${spec.conditions.map((item) => elasticCondition(item)).join(joiner(spec, true))}${spec.timeWindow?.kind === 'relative' ? `${spec.conditions.length ? ' and ' : ''}@timestamp >= now-${relative(spec.timeWindow.last)}` : spec.timeWindow ? `${spec.conditions.length ? ' and ' : ''}@timestamp >= ${iso(safeTime(spec.timeWindow.fromISO))} and @timestamp <= ${iso(safeTime(spec.timeWindow.toISO))}` : ''}` },
  { id: 'elastic-eql', name: 'Elastic EQL', generate: (spec) => `${safeIdentifier(spec.dataSource, 'any')} where ${[spec.conditions.map(eqlCondition).join(joiner(spec, true)), spec.timeWindow?.kind === 'relative' ? `@timestamp > now() - ${relative(spec.timeWindow.last)}` : spec.timeWindow ? `@timestamp >= ${iso(safeTime(spec.timeWindow.fromISO))} and @timestamp <= ${iso(safeTime(spec.timeWindow.toISO))}` : ''].filter(Boolean).join(' and ') || 'true'}` },
  { id: 'lucene', name: 'Lucene query_string', generate: (spec) => `${spec.conditions.map((item) => elasticCondition(item, true)).join(joiner(spec))}${spec.timeWindow?.kind === 'relative' ? `${spec.conditions.length ? ' AND ' : ''}@timestamp:[now-${relative(spec.timeWindow.last)} TO now]` : spec.timeWindow ? `${spec.conditions.length ? ' AND ' : ''}@timestamp:[${safeTime(spec.timeWindow.fromISO)} TO ${safeTime(spec.timeWindow.toISO)}]` : ''}` },
  { id: 'grep', name: 'grep / regex', generate: (spec) => `grep -E ${shellQuote(spec.conditions.flatMap(values).map(regexEscape).join('|') || 'value')}` },
]

const yamlQuote = (value: string) => `'${value.replace(/'/gu, "''")}'`
const xmlEscape = (value: string) => value.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/"/gu, '&quot;').replace(/'/gu, '&apos;')

export function generateSigma(spec: QuerySpec): string {
  const positive = spec.conditions.filter((condition) => condition.op !== 'not_equals')
  const negative = spec.conditions.filter((condition) => condition.op === 'not_equals')
  const conditionLines = (condition: QuerySpec['conditions'][number]): string[] => {
    const modifier = condition.op === 'contains' ? '|contains' : ''
    const key = `${safeIdentifier(condition.field, '__UNSAFE_FIELD__')}${modifier}`
    const list = values(condition)
    return list.length > 1 ? [`    ${key}:`, ...list.map((value) => `      - ${yamlQuote(value)}`)] : [`    ${key}: ${yamlQuote(list[0])}`]
  }
  const selections = spec.combinator === 'OR'
    ? positive.flatMap((condition, index) => [`  selection${index + 1}:`, ...conditionLines(condition)])
    : positive.length ? ['  selection:', ...positive.flatMap(conditionLines)] : negative.length ? ['  selection: {}'] : []
  const filters = negative.flatMap((condition, index) => [`  filter${index + 1}:`, `    ${safeIdentifier(condition.field, '__UNSAFE_FIELD__')}: ${yamlQuote(values(condition)[0])}`])
  const condition = spec.combinator === 'OR' ? `${positive.length ? '1 of selection*' : ''}${negative.length ? `${positive.length ? ' or ' : ''}not 1 of filter*` : ''}` : `${positive.length || negative.length ? 'selection' : 'true'}${negative.map((_, index) => ` and not filter${index + 1}`).join('')}`
  const limitation = negative.length && spec.combinator === 'OR' ? ['# Limitation: OR with not_equals is emitted as a coarse starting skeleton; verify the logic before use.'] : []
  return ['title: Starting detection rule', 'status: experimental', 'logsource:', `  category: ${yamlQuote(safeIdentifier(spec.dataSource, 'placeholder'))}`, 'detection:', ...selections, ...filters, `  condition: ${condition}`, ...limitation, 'falsepositives:', '  - Adjust for expected activity in your environment', 'level: medium'].join('\n')
}

export function generateWazuh(spec: QuerySpec): string {
  const fields = spec.conditions.map((condition) => {
    const content = values(condition).map(xmlEscape).join('|')
    const field = safeIdentifier(condition.field, '__UNSAFE_FIELD__')
    const attribute = condition.op === 'not_equals' ? ' negate="yes"' : ''
    return condition.field ? `  <field name="${xmlEscape(field)}"${attribute}>${content}</field>` : `  <match>${content}</match>`
  })
  return ['<rule id="100000" level="5">', ...fields, '  <description>Starting detection rule - adjust placeholder id and level</description>', '</rule>'].join('\n')
}

export function extractIocValues(text: string): string[] {
  const parsed = extractIocs(text, { output: 'refang' }).groups.flatMap((group) => group.entries.map((entry) => entry.value))
  if (parsed.length) return parsed
  return [...new Set(text.split(/\r?\n|,/u).map((item) => item.trim()).filter(Boolean))]
}

export function generateAll(spec: QuerySpec) {
  return [...dialects.map((dialect) => ({ id: dialect.id, name: dialect.name, value: dialect.generate(spec) })), { id: 'sigma', name: 'Sigma rule', value: generateSigma(spec) }, { id: 'wazuh', name: 'Wazuh rule', value: generateWazuh(spec) }]
}
