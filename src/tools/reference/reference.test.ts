import { describe, expect, it } from 'vitest'
import { filterReferenceEntries, getReferenceSection, referenceSections } from './reference'

describe('reference dataset', () => {
  it('contains populated sections and well-formed entries', () => {
    expect(referenceSections).toHaveLength(5)
    for (const section of referenceSections) {
      expect(section.entries.length).toBeGreaterThan(0)
      for (const entry of section.entries) {
        expect(entry.command.trim()).not.toBe('')
        expect(entry.description.trim()).not.toBe('')
      }
    }
  })

  it('filters commands and descriptions across all sections', () => {
    expect(filterReferenceEntries('nmap').every((entry) => entry.command.includes('nmap'))).toBe(true)
    expect(filterReferenceEntries('kql').length).toBeGreaterThan(0)
    expect(filterReferenceEntries('kql').some((entry) => entry.command.includes('SecurityEvent'))).toBe(true)
  })

  it('returns the selected section entries', () => {
    expect(getReferenceSection('connect').entries[0].command).toBe('sudo openvpn user.ovpn')
    expect(getReferenceSection('windows').entries.some((entry) => entry.command.includes('Get-WinEvent'))).toBe(true)
  })
})
