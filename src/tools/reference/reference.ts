export interface ReferenceEntry {
  command: string
  description: string
}

export interface ReferenceSection {
  id: ReferenceSectionId
  entries: readonly ReferenceEntry[]
}

export type ReferenceSectionId = 'connect' | 'enumerate' | 'siem' | 'linux' | 'windows'

export const referenceSections: readonly ReferenceSection[] = [
  {
    id: 'connect',
    entries: [
      { command: 'sudo openvpn user.ovpn', description: 'Start the HTB VPN from Kali or Pwnbox; keep this terminal open.' },
      { command: 'ip a show tun0', description: 'Confirm that the VPN tunnel interface exists and has an address.' },
      { command: 'ping -c 3 10.10.10.x', description: 'Check basic reachability to an HTB target; ICMP may be filtered.' },
      { command: 'ssh user@target', description: 'Connect to an SSH service using a username and target address.' },
      { command: 'chmod 600 id_rsa && ssh -i id_rsa user@target', description: 'Restrict a private key before using it for SSH authentication.' },
      { command: 'xfreerdp /u:user /p:password /v:target', description: 'Connect to RDP; quote or omit the password when shell characters are involved.' },
      { command: 'xfreerdp3 /u:user /p:password /v:target', description: 'Use the versioned FreeRDP binary when xfreerdp is not installed.' },
      { command: 'evil-winrm -i target -u user -p password', description: 'Open a WinRM shell when the target exposes WinRM and credentials are authorized.' },
      { command: 'ip route | grep tun0', description: 'Check that routes to the HTB network use the VPN tunnel.' },
      { command: 'ss -lntup', description: 'Find local listeners when diagnosing a VPN, proxy, or port conflict.' },
    ],
  },
  {
    id: 'enumerate',
    entries: [
      { command: 'nmap -sC -sV -p- -oA scans/all target', description: 'Full TCP port scan with default scripts, version detection, and saved output.' },
      { command: 'nmap -Pn -p 80,443,8080 target', description: 'Scan selected web ports when host discovery is blocked or unnecessary.' },
      { command: 'nmap -sU --top-ports 100 target', description: 'Initial UDP triage over common ports; UDP results often need follow-up.' },
      { command: 'curl -i http://target/', description: 'Inspect HTTP response headers and the first response body.' },
      { command: 'gobuster dir -u http://target/ -w /usr/share/wordlists/dirb/common.txt', description: 'Discover common web paths with a wordlist; review status codes and false positives.' },
      { command: 'ffuf -u http://target/FUZZ -w wordlist.txt -fc 404', description: 'Fuzz a path component while filtering a known not-found response.' },
      { command: 'smbclient -L //target -N', description: 'List SMB shares with anonymous authentication when permitted.' },
      { command: 'smbclient //target/share -U user', description: 'Connect to a named SMB share for authorized file enumeration.' },
      { command: 'crackmapexec smb target --shares -u user -p password', description: 'Enumerate SMB host and share details with supplied credentials.' },
      { command: 'dig @target version.bind chaos txt', description: 'Request a DNS version string when the DNS service allows that query.' },
    ],
  },
  {
    id: 'siem',
    entries: [
      { command: 'index=main sourcetype=auth user="alice"', description: 'Splunk SPL field match; replace index, sourcetype, and field names.' },
      { command: 'index=main (action=failure OR status=failed) NOT user=svc_*', description: 'Splunk SPL boolean logic with a wildcard exclusion.' },
      { command: 'index=main earliest=-24h latest=now event_type=logon', description: 'Splunk SPL relative time window and event filter.' },
      { command: '| stats count min(_time) as first max(_time) as last by src_ip', description: 'Splunk SPL aggregation by source IP; add fields relevant to your data.' },
      { command: '| top limit=10 user', description: 'Splunk SPL top-N values for a field.' },
      { command: 'SecurityEvent | where Account has "alice" and EventID == 4624', description: 'Microsoft KQL field matching and boolean logic in a table pipeline.' },
      { command: 'SecurityEvent | where TimeGenerated between (ago(24h) .. now())', description: 'Microsoft KQL relative time window.' },
      { command: 'SecurityEvent | where Computer startswith "dc-" or IpAddress matches regex @"^10\\."', description: 'Microsoft KQL prefix and regex matching; adapt the field types.' },
      { command: 'SecurityEvent | summarize count(), dcount(Account) by IpAddress | top 10 by count_', description: 'Microsoft KQL aggregation followed by top-N results.' },
      { command: 'logs-* : event.category:authentication and user.name:"alice"', description: 'Elastic KQL field matching with a data-view selector; adapt the index pattern.' },
      { command: 'event.code:4625 and @timestamp >= now-24h', description: 'Elastic KQL time and event filter pattern.' },
      { command: 'process.name:(powershell.exe or cmd.exe) and not user.name:svc-*', description: 'Elastic KQL boolean logic and wildcard matching.' },
      { command: 'event.category:authentication and user.name:/admin.*/', description: 'Elastic KQL regex pattern; verify regex support and field mapping in the deployment.' },
      { command: 'event.code:4624 AND user.name:alice', description: 'Lucene query-string field and boolean pattern for a compatible search UI.' },
      { command: 'event.code:[4624 TO 4625] AND host.name:dc-*', description: 'Lucene range and wildcard pattern; syntax varies by query-string implementation.' },
      { command: 'event.category:authentication AND @timestamp:[now-24h TO now]', description: 'Lucene time range pattern; confirm the platform field and date syntax.' },
    ],
  },
  {
    id: 'linux',
    entries: [
      { command: 'grep -Ei "failed|invalid|accepted" /var/log/auth.log | tail -n 50', description: 'Review recent SSH authentication outcomes on Debian-family systems.' },
      { command: 'awk \'{print $1, $2, $3, $9}\' /var/log/auth.log | sort | uniq -c | sort -nr', description: 'Count repeated selected auth-log fields for quick triage.' },
      { command: 'journalctl -u ssh --since "24 hours ago" --no-pager', description: 'Read recent SSH service events from systemd journal.' },
      { command: 'journalctl -p warning..alert -b --no-pager', description: 'Review warning and higher priority messages from the current boot.' },
      { command: 'ausearch -m USER_LOGIN,USER_START -ts today -i', description: 'Search audit login and session records with human-readable fields.' },
      { command: 'aureport --auth --summary', description: 'Summarize Linux audit authentication activity.' },
      { command: 'last -ai | head -n 25; lastb -ai | head -n 25', description: 'Review successful and failed login records; access to lastb may require elevated privileges.' },
      { command: 'utmpdump /var/run/utmp', description: 'Inspect raw login accounting records when last output needs validation.' },
      { command: 'find /tmp /var/tmp -type f -mmin -60 -ls', description: 'Find recently modified files in common temporary directories.' },
      { command: 'find /etc /usr/local/bin -newermt "2026-01-01" -ls', description: 'Find files newer than a chosen timestamp; set the date for the case.' },
      { command: 'stat /path/to/file', description: 'Inspect timestamps, ownership, mode, and inode metadata for a file.' },
      { command: 'find /etc/cron* /var/spool/cron -type f -ls 2>/dev/null', description: 'Review common cron persistence locations.' },
      { command: 'cat ~/.bash_history; grep -R "history" /etc/profile /etc/profile.d 2>/dev/null', description: 'Review available shell history and history configuration as context.' },
      { command: 'ls -la /var/log /var/log/audit /var/log/journal 2>/dev/null', description: 'Locate common Linux, audit, and persistent journal directories.' },
      { command: 'zeek -r capture.pcap conn.log', description: 'Process a PCAP with Zeek and write connection-oriented logs.' },
      { command: 'tshark -r capture.pcap -Y "dns" -T fields -e frame.time -e ip.src -e dns.qry.name', description: 'Extract selected DNS fields from a PCAP for focused review.' },
    ],
  },
  {
    id: 'windows',
    entries: [
      { command: 'Get-WinEvent -FilterHashtable @{LogName="Security"; Id=4624,4625; StartTime=(Get-Date).AddHours(-24)}', description: 'PowerShell query for recent successful and failed logons.' },
      { command: 'wevtutil qe Security /q:"*[System[(EventID=4624 or EventID=4625)]]" /f:text /c:20', description: 'Read recent selected Security events using the native event utility.' },
      { command: 'Get-WinEvent -FilterHashtable @{LogName="System"; Id=7045}', description: 'Find service-installation events that may indicate persistence or software deployment.' },
      { command: 'Get-WinEvent -FilterHashtable @{LogName="Security"; Id=4672,4688,4720,4732}', description: 'Review privileged logon, process creation, account creation, and group-change events.' },
      { command: 'Get-WinEvent -LogName "Microsoft-Windows-Sysmon/Operational" -MaxEvents 50', description: 'Read recent Sysmon events; confirm the channel and deployed Sysmon configuration.' },
      { command: 'Get-WinEvent -FilterHashtable @{LogName="Microsoft-Windows-Sysmon/Operational"; Id=1,3,11,22}', description: 'Target common Sysmon process, network, file-create, and DNS event IDs.' },
      { command: 'wevtutil el', description: 'List event log channels available on the local Windows host.' },
      { command: 'Get-WinEvent -ListLog * | Where-Object IsEnabled | Select-Object LogName,RecordCount', description: 'List enabled channels and their approximate record counts.' },
      { command: 'Get-ChildItem "$env:WINDIR\\System32\\winevt\\Logs" | Sort-Object LastWriteTime -Descending', description: 'Locate Windows Event Log files and review their recent modification times.' },
      { command: 'Get-ChildItem -Force "$env:APPDATA\\Microsoft\\Windows\\PowerShell\\PSReadLine"', description: 'Check the common PowerShell command-history location for the current user.' },
      { command: 'Get-ScheduledTask | Where-Object State -ne "Disabled" | Select-Object TaskName,TaskPath,State', description: 'Inventory enabled scheduled tasks for defensive persistence triage.' },
      { command: 'Get-LocalUser; Get-LocalGroupMember -Group Administrators', description: 'Review local accounts and local administrator membership.' },
    ],
  },
] as const

export function getReferenceSection(id: ReferenceSectionId): ReferenceSection {
  return referenceSections.find((section) => section.id === id) ?? referenceSections[0]
}

export function filterReferenceEntries(query: string, sections: readonly ReferenceSection[] = referenceSections): ReferenceEntry[] {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return sections.flatMap((section) => section.entries)
  return sections.flatMap((section) => section.entries.filter((entry) => `${entry.command} ${entry.description}`.toLocaleLowerCase().includes(needle)))
}
