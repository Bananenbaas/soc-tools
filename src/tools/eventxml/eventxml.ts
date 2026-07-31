import { convertTimestamp } from '../timestamp/timestamp'

export interface EventField {
  key: string
  value: string
  section: 'System' | 'EventData'
}

export interface EventTimestamp {
  raw: string
  iso: string
  utc: string
  amsterdam: string
}

export interface ParsedWindowsEvent {
  eventId?: string
  provider?: string
  computer?: string
  channel?: string
  level?: string
  task?: string
  timestamp?: EventTimestamp
  user?: string
  sid?: string
  logonType?: string
  process?: string
  parentProcess?: string
  commandLine?: string
  sourceIp?: string
  sourcePort?: string
  destinationIp?: string
  destinationPort?: string
  fields: EventField[]
}

export type EventParseResult =
  | { events: ParsedWindowsEvent[]; error?: never }
  | { events: []; error: 'empty' | 'invalidXml' | 'invalidJson' | 'noEvents' }

function valueAt(values: Map<string, string>, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = values.get(name.toLowerCase())
    if (value !== undefined && value !== '') return value
  }
  return undefined
}

function eventTimestamp(raw: string | undefined): EventTimestamp | undefined {
  if (!raw) return undefined
  const epoch = Date.parse(raw)
  if (Number.isNaN(epoch)) return undefined
  const converted = convertTimestamp(epoch)
  return { raw, iso: converted.iso, utc: converted.utc, amsterdam: converted.amsterdam }
}

function buildEvent(fields: EventField[]): ParsedWindowsEvent {
  const values = new Map(fields.map((field) => [field.key.toLowerCase(), field.value]))
  const user = valueAt(values, 'SubjectUserName', 'TargetUserName', 'User')
  const sid = valueAt(values, 'UserID', 'SubjectUserSid', 'TargetUserSid', 'UserSid')
  return {
    eventId: valueAt(values, 'EventID'),
    provider: valueAt(values, 'Provider'),
    computer: valueAt(values, 'Computer'),
    channel: valueAt(values, 'Channel'),
    level: valueAt(values, 'Level'),
    task: valueAt(values, 'Task'),
    timestamp: eventTimestamp(valueAt(values, 'TimeCreated', 'SystemTime', 'UtcTime')),
    user,
    sid,
    logonType: valueAt(values, 'LogonType'),
    process: valueAt(values, 'NewProcessName', 'Image'),
    parentProcess: valueAt(values, 'ParentProcessName', 'ParentImage'),
    commandLine: valueAt(values, 'CommandLine', 'ProcessCommandLine'),
    sourceIp: valueAt(values, 'SourceIp', 'IpAddress', 'SourceAddress'),
    sourcePort: valueAt(values, 'SourcePort', 'IpPort'),
    destinationIp: valueAt(values, 'DestinationIp', 'DestinationAddress'),
    destinationPort: valueAt(values, 'DestinationPort'),
    fields,
  }
}

function directChild(parent: Element, localName: string): Element | undefined {
  return Array.from(parent.children).find((child) => child.localName === localName)
}

function xmlEvent(element: Element): ParsedWindowsEvent {
  const fields: EventField[] = []
  const system = directChild(element, 'System')
  if (system) {
    for (const node of Array.from(system.children)) {
      const text = node.textContent?.trim()
      if (text) fields.push({ key: node.localName, value: text, section: 'System' })
      for (const attribute of Array.from(node.attributes)) {
        const isPrimary = (node.localName === 'Provider' && attribute.localName === 'Name')
          || (node.localName === 'TimeCreated' && attribute.localName === 'SystemTime')
          || (node.localName === 'Security' && attribute.localName === 'UserID')
        const key = isPrimary ? node.localName === 'Security' ? 'UserID' : node.localName : `${node.localName}.${attribute.name}`
        fields.push({ key, value: attribute.value, section: 'System' })
      }
    }
    for (const attribute of Array.from(system.attributes)) fields.push({ key: attribute.name, value: attribute.value, section: 'System' })
  }
  const eventData = directChild(element, 'EventData') ?? directChild(element, 'UserData')
  if (eventData) {
    for (const node of Array.from(eventData.getElementsByTagName('*')).filter((candidate) => candidate.localName === 'Data')) {
      const key = node.getAttribute('Name') || node.localName
      fields.push({ key, value: node.textContent?.trim() ?? '', section: 'EventData' })
    }
  }
  return buildEvent(fields)
}

function scalar(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return undefined
}

function findObjectValue(object: Record<string, unknown>, name: string): unknown {
  const entry = Object.entries(object).find(([key]) => key.toLowerCase() === name.toLowerCase())
  return entry?.[1]
}

function jsonFields(object: Record<string, unknown>): EventField[] {
  const fields: EventField[] = []
  const systemValue = findObjectValue(object, 'System')
  const system = systemValue && typeof systemValue === 'object' && !Array.isArray(systemValue) ? systemValue as Record<string, unknown> : object
  for (const [key, raw] of Object.entries(system)) {
    if (key.toLowerCase() === 'eventdata') continue
    if (key.toLowerCase() === 'provider' && raw && typeof raw === 'object') {
      const name = scalar(findObjectValue(raw as Record<string, unknown>, 'Name'))
      if (name) fields.push({ key: 'Provider', value: name, section: 'System' })
      continue
    }
    if (key.toLowerCase() === 'timecreated' && raw && typeof raw === 'object') {
      const time = scalar(findObjectValue(raw as Record<string, unknown>, 'SystemTime'))
      if (time) fields.push({ key: 'TimeCreated', value: time, section: 'System' })
      continue
    }
    if (key.toLowerCase() === 'security' && raw && typeof raw === 'object') {
      for (const [securityKey, securityValue] of Object.entries(raw as Record<string, unknown>)) {
        const value = scalar(securityValue)
        if (value !== undefined) fields.push({ key: securityKey, value, section: 'System' })
      }
      continue
    }
    const value = scalar(raw)
    if (value !== undefined) fields.push({ key, value, section: 'System' })
  }
  const eventDataValue = findObjectValue(object, 'EventData') ?? findObjectValue(system, 'EventData')
  if (Array.isArray(eventDataValue)) {
    for (const item of eventDataValue) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      const record = item as Record<string, unknown>
      const key = scalar(findObjectValue(record, 'Name'))
      const value = scalar(findObjectValue(record, 'Value') ?? findObjectValue(record, '#text'))
      if (key && value !== undefined) fields.push({ key, value, section: 'EventData' })
    }
  }
  if (eventDataValue && typeof eventDataValue === 'object' && !Array.isArray(eventDataValue)) {
    for (const [key, raw] of Object.entries(eventDataValue as Record<string, unknown>)) {
      const value = scalar(raw)
      if (value !== undefined) fields.push({ key, value, section: 'EventData' })
    }
  }
  return fields
}

function parseJson(input: string): EventParseResult {
  try {
    const parsed: unknown = JSON.parse(input)
    const items = Array.isArray(parsed) ? parsed : [parsed]
    if (!items.length || items.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) return { events: [], error: 'noEvents' }
    return { events: items.map((item) => {
      const object = item as Record<string, unknown>
      const wrapped = findObjectValue(object, 'Event')
      const event = wrapped && typeof wrapped === 'object' && !Array.isArray(wrapped) ? wrapped as Record<string, unknown> : object
      return buildEvent(jsonFields(event))
    }) }
  } catch {
    return { events: [], error: 'invalidJson' }
  }
}

function parseXml(input: string): EventParseResult {
  const withoutDeclarations = input.replace(/<\?xml[\s\S]*?\?>/giu, '')
  const document = new DOMParser().parseFromString(`<Events>${withoutDeclarations}</Events>`, 'application/xml')
  if (document.getElementsByTagName('parsererror').length) return { events: [], error: 'invalidXml' }
  const elements = Array.from(document.getElementsByTagName('*')).filter((element) => element.localName === 'Event')
  if (!elements.length) return { events: [], error: 'noEvents' }
  return { events: elements.map(xmlEvent) }
}

export function parseWindowsEvents(input: string): EventParseResult {
  const trimmed = input.trim()
  if (!trimmed) return { events: [], error: 'empty' }
  return trimmed.startsWith('<') ? parseXml(trimmed) : parseJson(trimmed)
}

export const logonTypeKeys: Readonly<Record<string, string>> = {
  '2': 'interactive', '3': 'network', '4': 'batch', '5': 'service', '7': 'unlock', '8': 'networkCleartext', '9': 'newCredentials', '10': 'remoteInteractive', '11': 'cachedInteractive',
}
