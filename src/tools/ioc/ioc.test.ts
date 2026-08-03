import { describe, expect, it } from 'vitest'
import { extractIocs, iocsToCsv, iocsToJson, type IocType } from './ioc'

function entries(text: string, type: IocType) {
  return extractIocs(text).groups.find((group) => group.type === type)?.entries ?? []
}

describe('IOC extraction and normalization', () => {
  it('extracts a mixed fanged and defanged sample by type', () => {
    const sample = [
      'hxxps[://]Example[.]COM/CasePath?q=A user[@]Sub[.]Example[.]com 1[.]2[.]3[.]4',
      '2001:db8::1 CVE-2026-12345 d41d8cd98f00b204e9800998ecf8427e',
      'DA39A3EE5E6B4B0D3255BFEF95601890AFD80709 ' + 'A'.repeat(64),
      String.raw`C:\Windows\System32\cmd.exe HKLM\Software\Microsoft`,
    ].join('\n')

    const result = extractIocs(sample)
    expect(entries(sample, 'url')[0]?.value).toBe('https://example.com/CasePath?q=A')
    expect(entries(sample, 'email')[0]?.value).toBe('user@sub.example.com')
    expect(entries(sample, 'ipv4')[0]?.value).toBe('1.2.3.4')
    expect(entries(sample, 'ipv6')[0]?.value).toBe('2001:db8::1')
    expect(entries(sample, 'cve')[0]?.value).toBe('CVE-2026-12345')
    expect(entries(sample, 'md5')).toHaveLength(1)
    expect(entries(sample, 'sha1')).toHaveLength(1)
    expect(entries(sample, 'sha256')).toHaveLength(1)
    expect(entries(sample, 'windows-path')).toHaveLength(1)
    expect(entries(sample, 'registry-key')).toHaveLength(1)
    expect(result.total).toBeGreaterThanOrEqual(10)
  })

  it('rejects invalid IPv4 candidates and reports the rejection', () => {
    const result = extractIocs('999.999.1.1 and 256.2.3.4 but 192.0.2.1')
    expect(result.groups.find((group) => group.type === 'ipv4')?.entries.map((entry) => entry.value)).toEqual(['192.0.2.1'])
    expect(result.rejectedCount).toBe(2)
  })

  it('preserves and validates IPv6 compression and IPv4-mapped forms', () => {
    const result = extractIocs('::1 fe80:: 2001:db8::1 ::ffff:192.0.2.1 a::b::c')
    const values = result.groups.find((group) => group.type === 'ipv6')?.entries.map((entry) => entry.value) ?? []
    expect(values).toHaveLength(4)
    expect(values).toEqual(expect.arrayContaining(['::1', 'fe80::', '2001:db8::1', '::ffff:192.0.2.1']))
    expect(values).not.toContain('a::b::c')
  })

  it('classifies exact hash lengths and lowercases them', () => {
    const text = `${'A'.repeat(32)} ${'B'.repeat(40)} ${'C'.repeat(64)}`
    expect(entries(text, 'md5')[0]?.value).toBe('a'.repeat(32))
    expect(entries(text, 'sha1')[0]?.value).toBe('b'.repeat(40))
    expect(entries(text, 'sha256')[0]?.value).toBe('c'.repeat(64))
  })

  it('strips prose punctuation, deduplicates, and tracks occurrences and lines', () => {
    const result = extractIocs('Example.COM, https://EXAMPLE.com/Path).\nexample.com; https://example.COM/Path')
    const domain = result.groups.find((group) => group.type === 'domain')?.entries[0]
    const url = result.groups.find((group) => group.type === 'url')?.entries[0]
    expect(domain).toMatchObject({ value: 'example.com', count: 2, sourceLines: [1, 2] })
    expect(url).toMatchObject({ value: 'https://example.com/Path', count: 2, sourceLines: [1, 2] })
  })

  it('validates domains and email domains and counts invalid candidates', () => {
    const result = extractIocs('user@bad_domain.com good@Example.COM bad_domain.com')
    expect(entries('good@Example.COM', 'email')[0]?.value).toBe('good@example.com')
    expect(result.rejectedCount).toBeGreaterThan(0)
  })

  it('rejects file extensions as standalone domain TLDs while preserving real and contextual domains', () => {
    const text = 'regsvr32.exe scrobj.dll example.com sub.example.co.uk xn--bcher-kva.de http://regsvr32.exe/file.dll user@scrobj.dll'
    const result = extractIocs(text)

    expect(result.groups.find((group) => group.type === 'domain')?.entries.map((entry) => entry.value)).toEqual([
      'example.com',
      'sub.example.co.uk',
      'xn--bcher-kva.de',
    ])
    expect(result.groups.find((group) => group.type === 'url')?.entries.map((entry) => entry.value)).toEqual(['http://regsvr32.exe/file.dll'])
    expect(result.groups.find((group) => group.type === 'email')?.entries.map((entry) => entry.value)).toEqual(['user@scrobj.dll'])
    expect(result.rejectedCount).toBe(2)
  })

  it('can return defanged values and export report rows', () => {
    const result = extractIocs('https://Example.com/A', { output: 'defang' })
    expect(result.groups.find((group) => group.type === 'url')?.entries[0]?.value).toBe('hxxps[://]example[.]com/A')
    expect(iocsToCsv(result)).toContain('"type","value","count","source lines"')
    expect(JSON.parse(iocsToJson(result))).toHaveLength(1)
  })
})
