import { describe, expect, it } from 'vitest'
import { defang, refang } from './defang'

describe('Defang and refang', () => {
  it.each([
    ['http://example.com/a', 'hxxp[://]example[.]com/a'],
    ['https://sub.example.org', 'hxxps[://]sub[.]example[.]org'],
    ['analyst@example.com', 'analyst[@]example[.]com'],
    ['192.0.2.1', '192[.]0[.]2[.]1'],
  ])('defangs %j', (plain, safe) => {
    expect(defang(plain)).toBe(safe)
    expect(refang(safe)).toBe(plain)
  })
  it('refangs common dot variants', () => {
    expect(refang('example(dot)com example[dot]org')).toBe('example.com example.org')
  })
})
