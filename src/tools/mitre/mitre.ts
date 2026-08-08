import { attackCatalog, attackCatalogMetadata, type AttackTechnique } from './attack-catalog'

export { attackCatalog, attackCatalogMetadata }
export type { AttackTechnique }

export const tacticOrder = ['initial-access', 'execution', 'persistence', 'privilege-escalation', 'defense-evasion', 'credential-access', 'discovery', 'lateral-movement', 'collection', 'command-and-control', 'exfiltration', 'impact', 'reconnaissance', 'resource-development', 'other'] as const
export type TechniqueGroup = { readonly tactic: string; readonly techniques: readonly AttackTechnique[] }
export type Recognition = { readonly matched: readonly AttackTechnique[]; readonly unknown: readonly string[] }

const techniqueById = new Map(attackCatalog.map((technique) => [technique.id, technique]))
const idPattern = /\bT\d{4}(?:\.\d{3})?\b/gu

export function recognise(input: string): Recognition {
  const ids = [...new Set(input.match(idPattern) ?? [])]
  return { matched: ids.flatMap((id) => techniqueById.has(id) ? [techniqueById.get(id)!] : []), unknown: ids.filter((id) => !techniqueById.has(id)) }
}

export function searchTechniques(query: string): readonly AttackTechnique[] {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return []
  return attackCatalog.filter((technique) => `${technique.id} ${technique.name} ${technique.tactics.join(' ')}`.toLocaleLowerCase().includes(needle))
}

export function groupByTactic(techniques: readonly AttackTechnique[]): readonly TechniqueGroup[] {
  const unique = [...new Map(techniques.map((technique) => [technique.id, technique])).values()]
  const known = tacticOrder.flatMap((tactic) => unique.some((technique) => technique.tactics.includes(tactic)) ? [{ tactic, techniques: unique.filter((technique) => technique.tactics.includes(tactic)) }] : [])
  const extraTactics = [...new Set(unique.flatMap((technique) => technique.tactics))].filter((tactic) => !tacticOrder.includes(tactic as typeof tacticOrder[number])).sort()
  return [...known, ...extraTactics.map((tactic) => ({ tactic, techniques: unique.filter((technique) => technique.tactics.includes(tactic)) }))]
}

function csvCell(value: string): string { return `"${value.replaceAll('"', '""')}"` }
export function toCsv(techniques: readonly AttackTechnique[]): string { return ['id,name,tactics,url', ...techniques.map((technique) => [technique.id, technique.name, technique.tactics.join('; '), technique.url].map(csvCell).join(','))].join('\n') }
export function toMarkdown(techniques: readonly AttackTechnique[]): string { return ['| ID | Name | Tactic(s) | URL |', '| --- | --- | --- | --- |', ...techniques.map((technique) => `| ${technique.id} | ${technique.name.replaceAll('|', '\\|')} | ${technique.tactics.join(', ')} | ${technique.url} |`)].join('\n') }
