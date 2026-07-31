// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { parseWindowsEvents } from './eventxml'

const event4688 = `<Event xmlns="http://schemas.microsoft.com/win/2004/08/events/event">
  <System><Provider Name="Microsoft-Windows-Security-Auditing"/><EventID>4688</EventID><Level>0</Level><Task>13312</Task><TimeCreated SystemTime="2024-01-15T13:45:30.000Z"/><Channel>Security</Channel><Computer>host01.example.test</Computer><Security UserID="S-1-5-18"/></System>
  <EventData><Data Name="SubjectUserName">analyst</Data><Data Name="NewProcessName">C:\\Windows\\System32\\cmd.exe</Data><Data Name="ParentProcessName">C:\\Windows\\explorer.exe</Data><Data Name="CommandLine">cmd.exe /c whoami</Data></EventData>
</Event>`

const sysmon1 = `<Event xmlns="http://schemas.microsoft.com/win/2004/08/events/event"><System><Provider Name="Microsoft-Windows-Sysmon"/><EventID>1</EventID><TimeCreated SystemTime="2024-02-01T10:00:00.000Z"/><Computer>ws01</Computer></System><EventData><Data Name="UtcTime">2024-02-01 10:00:00.000</Data><Data Name="Image">C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe</Data><Data Name="CommandLine">powershell.exe -NoProfile</Data><Data Name="User">LAB\\alice</Data><Data Name="ParentImage">C:\\Windows\\explorer.exe</Data></EventData></Event>`

const logon4624 = `<Event xmlns="http://schemas.microsoft.com/win/2004/08/events/event"><System><Provider Name="Microsoft-Windows-Security-Auditing"/><EventID>4624</EventID></System><EventData><Data Name="TargetUserName">bob</Data><Data Name="LogonType">10</Data><Data Name="IpAddress">192.0.2.25</Data><Data Name="IpPort">51342</Data></EventData></Event>`

function first(input: string) {
  const result = parseWindowsEvents(input)
  expect(result.error).toBeUndefined()
  return result.events[0]!
}

describe('Windows Event XML parser', () => {
  it('extracts a genuine 4688 process creation event and converts its timestamp', () => {
    const event = first(event4688)
    expect(event).toMatchObject({ eventId: '4688', provider: 'Microsoft-Windows-Security-Auditing', user: 'analyst', sid: 'S-1-5-18', process: 'C:\\Windows\\System32\\cmd.exe', parentProcess: 'C:\\Windows\\explorer.exe', commandLine: 'cmd.exe /c whoami' })
    expect(event.timestamp?.iso).toBe('2024-01-15T13:45:30.000Z')
    expect(event.timestamp?.utc).toContain('13:45:30')
  })

  it('maps Sysmon Event ID 1 field names', () => {
    expect(first(sysmon1)).toMatchObject({ eventId: '1', user: 'LAB\\alice', process: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', parentProcess: 'C:\\Windows\\explorer.exe', commandLine: 'powershell.exe -NoProfile' })
  })

  it('extracts a 4624 logon type and network source', () => {
    expect(first(logon4624)).toMatchObject({ eventId: '4624', user: 'bob', logonType: '10', sourceIp: '192.0.2.25', sourcePort: '51342' })
  })

  it('returns a friendly error for malformed XML without throwing', () => {
    expect(parseWindowsEvents('<Event><System><EventID>4688</System></Event>')).toEqual({ events: [], error: 'invalidXml' })
  })

  it('parses an exported JSON event equivalently', () => {
    const event = first(JSON.stringify({ System: { Provider: { Name: 'Microsoft-Windows-Sysmon' }, EventID: 1, TimeCreated: { SystemTime: '2024-02-01T10:00:00.000Z' }, Computer: 'ws01' }, EventData: { Image: 'C:\\Windows\\cmd.exe', ParentImage: 'C:\\Windows\\explorer.exe', CommandLine: 'cmd.exe /c whoami', User: 'LAB\\alice', SourceIp: '192.0.2.10', DestinationIp: '198.51.100.20', DestinationPort: 443 } }))
    expect(event).toMatchObject({ eventId: '1', provider: 'Microsoft-Windows-Sysmon', process: 'C:\\Windows\\cmd.exe', parentProcess: 'C:\\Windows\\explorer.exe', user: 'LAB\\alice', destinationPort: '443' })
    expect(event.timestamp?.iso).toBe('2024-02-01T10:00:00.000Z')
  })

  it('parses multiple XML events and JSON arrays', () => {
    expect(parseWindowsEvents(`${event4688}${sysmon1}`).events).toHaveLength(2)
    expect(parseWindowsEvents('[{"EventID":4688},{"EventID":4624}]').events.map((event) => event.eventId)).toEqual(['4688', '4624'])
  })
})
