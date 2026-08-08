import { describe, expect, it } from 'vitest'
import { attackCatalog, groupByTactic, recognise, searchTechniques, toCsv, toMarkdown } from './mitre'

describe('MITRE ATT&CK mapper', () => {
  it('contains a valid bundled catalog', () => {
    expect(attackCatalog.length).toBeGreaterThan(0)
    for (const technique of attackCatalog) {
      expect(technique.id).toMatch(/^T\d{4}(?:\.\d{3})?$/u)
      expect(technique.name).toBeTruthy(); expect(technique.tactics.length).toBeGreaterThan(0); expect(technique.url).toMatch(/^https:\/\//u)
    }
  })
  it('recognises known and unknown IDs', () => {
    const result = recognise('PowerShell T1059 and T1059.001, plus T9999.')
    expect(result.matched.map((item) => item.id)).toEqual(['T1059', 'T1059.001'])
    expect(result.matched.find((item) => item.id === 'T1059')?.name).toBeTruthy()
    expect(result.matched.find((item) => item.id === 'T1059.001')?.tactics.length).toBeGreaterThan(0)
    expect(result.unknown).toEqual(['T9999'])
  })
  it('searches names and tactics', () => { expect(searchTechniques('powershell').some((item) => item.id === 'T1059.001')).toBe(true) })
  it('groups techniques in tactic order without duplicates', () => {
    const techniques = [attackCatalog.find((item) => item.id === 'T1059')!, attackCatalog.find((item) => item.id === 'T1059.001')!]
    const groups = groupByTactic(techniques)
    expect(groups.length).toBeGreaterThan(0); expect(groups[0]?.techniques.map((item) => item.id)).toEqual(['T1059', 'T1059.001'])
    expect(new Set(groups.flatMap((group) => group.techniques.map((item) => item.id)))).toEqual(new Set(['T1059', 'T1059.001']))
  })
  it('exports report-ready CSV and Markdown', () => {
    const techniques = [attackCatalog.find((item) => item.id === 'T1059')!]
    expect(toCsv(techniques)).toContain('id,name,tactics,url'); expect(toCsv(techniques)).toContain('T1059')
    expect(toMarkdown(techniques)).toContain('| ID | Name | Tactic(s) | URL |'); expect(toMarkdown(techniques)).toContain('| T1059 |')
  })
})
