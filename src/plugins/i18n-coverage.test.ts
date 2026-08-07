import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { pluginMessages } from './index'
import { createMessageTree, mergeMessageTrees } from './merge'
import { hasPath } from './validate'

const dynamicKeyInventory: Record<string, readonly string[]> = {
  'tools.base64.': ['standard', 'url'],
  'tools.deobfuscator.steps.': ['base64', 'hex', 'escapes', 'fromCharCode', 'concatenation', 'atob', 'dean-edwards'],
  'tools.deobfuscator.errors.': ['timeout', 'memory', 'runtime'],
  'tools.evidencetimeline.modes.': ['parse', 'notes', 'flags'],
  'tools.evidencetimeline.tactics.': ['initial-access', 'execution', 'persistence', 'privilege-escalation', 'defense-evasion', 'credential-access', 'discovery', 'lateral-movement', 'collection', 'command-and-control', 'exfiltration', 'impact', 'other'],
  'tools.entropy.invalid.': ['text', 'hex', 'base64'],
  'tools.entropy.modes.': ['text', 'hex', 'base64'],
  'tools.eventxml.errors.': ['empty', 'invalidXml', 'invalidJson', 'noEvents'],
  'tools.eventxml.fields.': ['eventId', 'provider', 'computer', 'channel', 'level', 'task', 'user', 'sid', 'logonType', 'process', 'parentProcess', 'commandLine', 'sourceIp', 'sourcePort', 'destinationIp', 'destinationPort'],
  'tools.eventxml.logonTypes.': ['interactive', 'network', 'batch', 'service', 'unlock', 'networkCleartext', 'newCredentials', 'remoteInteractive', 'cachedInteractive'],
  'tools.ioc.types.': ['ipv4', 'ipv6', 'domain', 'url', 'md5', 'sha1', 'sha256', 'email', 'cve', 'windows-path', 'registry-key'],
  'tools.netlogs.formats.': ['zeek-tsv', 'zeek-json', 'suricata-eve', 'unknown'],
  'tools.netlogs.columns.': ['timestampUtc', 'src_ip', 'dest_ip', 'src_port', 'dest_port', 'proto', 'event_type', 'service', 'alert_signature', 'domain', 'ja3', 'ja3s', 'count', 'bytes'],
  'tools.ipcidr.classifications.': ['private', 'loopback', 'link-local', 'multicast', 'documentation', 'reserved/unspecified', 'global unicast (public)'],
  'tools.psdecoder.views.': ['raw', 'normalized', 'hex', 'strings', 'indicators'],
  'tools.querywizard.': ['none', 'relative', 'absolute'],
  'tools.querywizard.modes.': ['wizard', 'quick'],
  'tools.querywizard.steps.': ['intent', 'siem', 'conditions', 'time', 'result'],
  'tools.querywizard.presets.': ['user.name', 'user.help', 'host.name', 'host.help', 'ip.name', 'ip.help', 'hash.name', 'hash.help', 'blank.name', 'blank.help'],
  'tools.querywizard.dialectNotes.': ['splunk', 'kusto', 'elastic-kql', 'elastic-eql', 'lucene', 'grep'],
  'tools.querywizard.preview.emptyNotes.': ['splunk', 'kusto', 'elastic-kql', 'elastic-eql', 'lucene', 'grep'],
  'tools.strings.invalid.': ['hex', 'base64'],
  'tools.strings.': [],
  'tools.unicodeinspect.decodeKinds.': ['escapes', 'percent', 'html', 'punycode'],
  'tools.winartifacts.units.': ['seconds', 'milliseconds'],
  'tools.winartifacts.converters.': ['sid', 'guid', 'filetime', 'webkit', 'unix', 'accessMask', 'logonType', 'integrity'],
  'tools.winartifacts.placeholders.': ['sid', 'guid', 'filetime', 'webkit', 'unix', 'accessMask', 'logonType', 'integrity'],
  'tools.winartifacts.help.': ['sid', 'guid', 'filetime', 'webkit', 'unix', 'accessMask', 'logonType', 'integrity'],
  'tools.cmdline.flagReasons.': ['noProfile', 'windowStyle', 'executionPolicy', 'encodedCommand', 'command', 'nonInteractive', 'noLogo', 'sta', 'mta', 'file', 'cmdRunClose', 'cmdRunKeep'],
  'tools.cmdline.lolbinReasons.': ['rundll32', 'regsvr32', 'mshta', 'certutil', 'bitsadmin', 'wmic', 'msbuild', 'installutil', 'scriptHost', 'forfiles', 'hh', 'reg'],
  'tools.cmdline.encodedReasons.': ['base64Shape'],
  'tools.cmdline.parentReasons.': ['officeInterpreter', 'officeShell', 'mailShell', 'scriptInterpreter', 'scriptShell'],
}

function usedToolKeys(): { literal: Set<string>; dynamicPrefixes: Set<string> } {
  const literal = new Set<string>()
  const dynamicPrefixes = new Set<string>()
  const patterns = [/'tools\.[^']*'/gu, /"tools\.[^"]*"/gu, /`tools\.[^`]*`/gu]
  const files: string[] = []
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) visit(path)
      else if (entry.name.endsWith('.vue') || entry.name.endsWith('.ts')) files.push(path)
    }
  }
  visit(join(process.cwd(), 'src/tools'))
  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        const key = match[0].slice(1, -1)
        if (!key.includes('${')) literal.add(key)
        else dynamicPrefixes.add(key.slice(0, key.indexOf('${')))
      }
    }
  }
  return { literal, dynamicPrefixes }
}

describe('tool i18n coverage', () => {
  it('covers every literal and inventoried dynamic tool key in English and Dutch', () => {
    const messages = { en: createMessageTree(), nl: createMessageTree() }
    mergeMessageTrees(messages.en, pluginMessages.en)
    mergeMessageTrees(messages.nl, pluginMessages.nl)
    const used = usedToolKeys()

    for (const key of used.literal) {
      expect(hasPath(messages.en, key), `en ${key}`).toBe(true)
      expect(hasPath(messages.nl, key), `nl ${key}`).toBe(true)
    }
    for (const prefix of used.dynamicPrefixes) {
      expect(dynamicKeyInventory[prefix], `missing explicit inventory for ${prefix}`).toBeDefined()
      for (const suffix of dynamicKeyInventory[prefix] ?? []) {
        const key = `${prefix}${suffix}`
        expect(hasPath(messages.en, key), `en ${key}`).toBe(true)
        expect(hasPath(messages.nl, key), `nl ${key}`).toBe(true)
      }
    }
  })
})
