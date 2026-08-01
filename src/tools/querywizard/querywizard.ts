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

function relative(last: string): string {
  const clean = last.trim().replace(/^-+/u, '')
  return clean || '24h'
}

function splCondition(condition: QuerySpec['conditions'][number]): string {
  const list = values(condition)
  if (condition.op === 'in') return `${condition.field} IN (${list.map(quote).join(',')})`
  if (condition.op === 'contains') return `${condition.field}=${quote(`*${list[0]}*`)}`
  return `${condition.field}${condition.op === 'not_equals' ? '!=' : '='}${quote(list[0])}`
}

function kqlCondition(condition: QuerySpec['conditions'][number]): string {
  const list = values(condition)
  if (condition.op === 'in') return `${condition.field} in (${list.map(quote).join(',')})`
  if (condition.op === 'contains') return `${condition.field} contains ${quote(list[0])}`
  return `${condition.field} ${condition.op === 'not_equals' ? '!=' : '=='} ${quote(list[0])}`
}

function elasticCondition(condition: QuerySpec['conditions'][number], lucene = false): string {
  const list = values(condition)
  const separator = lucene ? ' OR ' : ' or '
  const expression = list.length > 1 || condition.op === 'in' ? `(${list.map(quote).join(separator)})` : quote(condition.op === 'contains' ? `*${list[0]}*` : list[0])
  return condition.op === 'not_equals' ? `NOT ${condition.field}:${expression}` : `${condition.field}${lucene ? ':' : ' : '}${expression}`
}

function eqlCondition(condition: QuerySpec['conditions'][number]): string {
  const list = values(condition)
  if (condition.op === 'in') return `${condition.field} in (${list.map(quote).join(',')})`
  if (condition.op === 'contains') return `${condition.field} : ${quote(`*${list[0]}*`)}`
  return `${condition.field} ${condition.op === 'not_equals' ? '!=' : '=='} ${quote(list[0])}`
}

function iso(value: string): string { return quote(value) }

export const dialects: Dialect[] = [
  { id: 'splunk', name: 'Splunk SPL', generate: (spec) => [spec.dataSource ? `index=${spec.dataSource}` : '', spec.conditions.map(splCondition).join(joiner(spec)), spec.timeWindow?.kind === 'relative' ? `earliest=-${relative(spec.timeWindow.last)}` : spec.timeWindow ? `earliest=${iso(spec.timeWindow.fromISO)} latest=${iso(spec.timeWindow.toISO)}` : ''].filter(Boolean).join(' ') },
  { id: 'kusto', name: 'Microsoft Kusto KQL', generate: (spec) => `${spec.dataSource?.trim() || 'TableName'}${spec.conditions.length ? ` | where ${spec.conditions.map(kqlCondition).join(joiner(spec, true))}` : ''}${spec.timeWindow?.kind === 'relative' ? ` | where Timestamp > ago(${relative(spec.timeWindow.last)})` : spec.timeWindow ? ` | where Timestamp between (datetime(${spec.timeWindow.fromISO}) .. datetime(${spec.timeWindow.toISO}))` : ''}` },
  { id: 'elastic-kql', name: 'Elastic KQL', generate: (spec) => `${spec.conditions.map((item) => elasticCondition(item)).join(joiner(spec, true))}${spec.timeWindow?.kind === 'relative' ? `${spec.conditions.length ? ' and ' : ''}@timestamp >= now-${relative(spec.timeWindow.last)}` : spec.timeWindow ? `${spec.conditions.length ? ' and ' : ''}@timestamp >= ${iso(spec.timeWindow.fromISO)} and @timestamp <= ${iso(spec.timeWindow.toISO)}` : ''}` },
  { id: 'elastic-eql', name: 'Elastic EQL', generate: (spec) => `${spec.dataSource?.trim() || 'any'} where ${[spec.conditions.map(eqlCondition).join(joiner(spec, true)), spec.timeWindow?.kind === 'relative' ? `@timestamp > now() - ${relative(spec.timeWindow.last)}` : spec.timeWindow ? `@timestamp >= ${iso(spec.timeWindow.fromISO)} and @timestamp <= ${iso(spec.timeWindow.toISO)}` : ''].filter(Boolean).join(' and ') || 'true'}` },
  { id: 'lucene', name: 'Lucene query_string', generate: (spec) => `${spec.conditions.map((item) => elasticCondition(item, true)).join(joiner(spec))}${spec.timeWindow?.kind === 'relative' ? `${spec.conditions.length ? ' AND ' : ''}@timestamp:[now-${relative(spec.timeWindow.last)} TO now]` : spec.timeWindow ? `${spec.conditions.length ? ' AND ' : ''}@timestamp:[${spec.timeWindow.fromISO} TO ${spec.timeWindow.toISO}]` : ''}` },
  { id: 'grep', name: 'grep / regex', generate: (spec) => `grep -E ${shellQuote(spec.conditions.flatMap(values).map(regexEscape).join('|') || 'value')}` },
]

const yamlQuote = (value: string) => `'${value.replace(/'/gu, "''")}'`
const xmlEscape = (value: string) => value.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/"/gu, '&quot;').replace(/'/gu, '&apos;')

export function generateSigma(spec: QuerySpec): string {
  const mapping = spec.conditions.flatMap((condition) => {
    const modifier = condition.op === 'contains' ? '|contains' : condition.op === 'in' ? '' : ''
    const key = `${condition.field}${modifier}`
    const list = values(condition)
    return list.length > 1 ? [`      ${key}:`, ...list.map((value) => `        - ${yamlQuote(value)}`)] : [`      ${key}: ${yamlQuote(list[0])}`]
  })
  return ['title: Starting detection rule', 'status: experimental', 'logsource:', `  category: ${yamlQuote(spec.dataSource || 'placeholder')}`, 'detection:', '  selection:', ...mapping, '  condition: selection', 'falsepositives:', '  - Adjust for expected activity in your environment', 'level: medium'].join('\n')
}

export function generateWazuh(spec: QuerySpec): string {
  const fields = spec.conditions.map((condition) => {
    const content = values(condition).map(xmlEscape).join('|')
    return condition.field ? `  <field name="${xmlEscape(condition.field)}">${content}</field>` : `  <match>${content}</match>`
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
