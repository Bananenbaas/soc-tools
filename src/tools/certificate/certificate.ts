import { formatHexBytes } from '../hex/hex'
import { convertTimestamp, type TimestampConversions } from '../timestamp/timestamp'

export interface DistinguishedNameAttribute { oid: string; label: string; value: string }
export interface DistinguishedName { text: string; attributes: DistinguishedNameAttribute[]; commonName?: string }
export interface AlternativeName { type: 'DNS' | 'IP' | 'Email'; value: string }
export interface CertificateValidity {
  notBefore: number; notAfter: number
  notBeforeFormatted: TimestampConversions; notAfterFormatted: TimestampConversions
  state: 'before' | 'within' | 'after'; days: number
}
export interface CertificateInspection {
  der: Uint8Array; pemBlockCount: number; version: number; serialHex: string
  signatureAlgorithm: { oid: string; name: string }
  issuer: DistinguishedName; subject: DistinguishedName; validity: CertificateValidity
  publicKey: { algorithmOid: string; algorithm: string; keySize?: number; curve?: string }
  keyUsage: string[]; extendedKeyUsage: string[]; subjectAlternativeNames: AlternativeName[]
  basicConstraints?: { ca: boolean; pathLength?: number }
  undecodedExtensionOids: string[]; fingerprints: { sha1?: string; sha256?: string }
}
export type CertificateResult = { ok: true; value: CertificateInspection } | { ok: false; error: { code: string; message: string } }

interface Node { tagClass: number; tag: number; constructed: boolean; start: number; valueStart: number; end: number; bytes: Uint8Array }
const decoder = new TextDecoder()
const DN_LABELS: Record<string, string> = { '2.5.4.3': 'CN', '2.5.4.10': 'O', '2.5.4.11': 'OU', '2.5.4.6': 'C', '2.5.4.7': 'L', '2.5.4.8': 'ST', '1.2.840.113549.1.9.1': 'emailAddress' }
const ALGORITHMS: Record<string, string> = {
  '1.2.840.113549.1.1.1': 'RSA', '1.2.840.113549.1.1.5': 'sha1WithRSAEncryption',
  '1.2.840.113549.1.1.11': 'sha256WithRSAEncryption', '1.2.840.113549.1.1.12': 'sha384WithRSAEncryption',
  '1.2.840.113549.1.1.13': 'sha512WithRSAEncryption', '1.2.840.10045.2.1': 'EC',
  '1.2.840.10045.4.3.2': 'ecdsa-with-SHA256', '1.2.840.10045.4.3.3': 'ecdsa-with-SHA384',
  '1.2.840.10045.4.3.4': 'ecdsa-with-SHA512', '1.3.101.112': 'Ed25519',
}
const CURVES: Record<string, string> = { '1.2.840.10045.3.1.7': 'P-256', '1.3.132.0.34': 'P-384', '1.3.132.0.35': 'P-521', '1.3.132.0.10': 'secp256k1' }
const EKU: Record<string, string> = { '1.3.6.1.5.5.7.3.1': 'TLS web server authentication', '1.3.6.1.5.5.7.3.2': 'TLS web client authentication', '1.3.6.1.5.5.7.3.3': 'Code signing', '1.3.6.1.5.5.7.3.4': 'Email protection', '1.3.6.1.5.5.7.3.8': 'Time stamping', '1.3.6.1.5.5.7.3.9': 'OCSP signing' }

function readNode(bytes: Uint8Array, offset: number, limit = bytes.length): Node {
  if (offset >= limit) throw new Error('Truncated ASN.1 tag')
  const first = bytes[offset++]!
  let tag = first & 31
  if (tag === 31) {
    tag = 0; let count = 0
    do { if (offset >= limit || count++ > 5) throw new Error('Invalid high-tag number'); tag = tag * 128 + (bytes[offset]! & 127) } while ((bytes[offset++]! & 128) !== 0)
  }
  if (offset >= limit) throw new Error('Truncated ASN.1 length')
  let length = bytes[offset++]!
  if (length & 128) {
    const count = length & 127
    if (!count || count > 4 || offset + count > limit) throw new Error('Invalid ASN.1 length')
    length = 0
    for (let index = 0; index < count; index++) length = length * 256 + bytes[offset++]!
  }
  if (length > limit - offset) throw new Error('Truncated ASN.1 value')
  return { tagClass: first >> 6, tag, constructed: Boolean(first & 32), start: offset, valueStart: offset, end: offset + length, bytes }
}

function children(node: Node): Node[] {
  const result: Node[] = []; let offset = node.valueStart
  while (offset < node.end) { const child = readNode(node.bytes, offset, node.end); result.push(child); offset = child.end }
  if (offset !== node.end) throw new Error('Invalid ASN.1 container')
  return result
}
function value(node: Node): Uint8Array { return node.bytes.subarray(node.valueStart, node.end) }
function expect(node: Node | undefined, tag: number, label: string): Node { if (!node || node.tagClass !== 0 || node.tag !== tag) throw new Error(`Invalid ${label}`); return node }
function oid(node: Node): string {
  const data = value(expect(node, 6, 'OID')); if (!data.length) throw new Error('Empty OID')
  const parts = [Math.min(2, Math.floor(data[0]! / 40)), data[0]! - Math.min(2, Math.floor(data[0]! / 40)) * 40]
  let current = 0
  for (const byte of data.subarray(1)) { current = current * 128 + (byte & 127); if (!(byte & 128)) { parts.push(current); current = 0 } }
  if (current) throw new Error('Truncated OID')
  return parts.join('.')
}
function integerNumber(node: Node): number { const data = value(expect(node, 2, 'INTEGER')); let result = 0; for (const byte of data) result = result * 256 + byte; return result }
function integerHex(node: Node): string { let data = value(expect(node, 2, 'serial number')); while (data.length > 1 && data[0] === 0) data = data.subarray(1); return formatHexBytes(data, true, 'none').match(/.{1,2}/gu)?.join(':') ?? '' }
function text(node: Node): string { if (node.tagClass !== 0 || ![12, 19, 20, 22, 30].includes(node.tag)) throw new Error('Unsupported ASN.1 string'); return node.tag === 30 ? Array.from(value(node)).reduce((out, byte, index, all) => index % 2 ? out + String.fromCharCode(all[index - 1]! * 256 + byte) : out, '') : decoder.decode(value(node)) }

function parseName(node: Node): DistinguishedName {
  const attributes: DistinguishedNameAttribute[] = []
  for (const set of children(expect(node, 16, 'distinguished name'))) for (const pair of children(expect(set, 17, 'RDN set'))) {
    const fields = children(expect(pair, 16, 'RDN')); const attributeOid = oid(fields[0]!); const label = DN_LABELS[attributeOid] ?? attributeOid
    attributes.push({ oid: attributeOid, label, value: text(fields[1]!) })
  }
  return { attributes, text: attributes.map((item) => `${item.label}=${item.value}`).join(', '), commonName: attributes.find((item) => item.label === 'CN')?.value }
}
function parseTime(node: Node): number {
  const input = decoder.decode(value(node)); let match: RegExpMatchArray | null
  if (node.tag === 23) { match = input.match(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/u); if (!match) throw new Error('Invalid UTCTime'); const year = Number(match[1]); return Date.UTC(year >= 50 ? 1900 + year : 2000 + year, Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6])) }
  if (node.tag === 24) { match = input.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/u); if (!match) throw new Error('Invalid GeneralizedTime'); return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6])) }
  throw new Error('Invalid validity time')
}
function parseAlgorithm(node: Node): { oid: string; name: string; parameters?: Node } { const fields = children(expect(node, 16, 'algorithm identifier')); const id = oid(fields[0]!); return { oid: id, name: ALGORITHMS[id] ?? id, parameters: fields[1] } }
function parseIp(bytes: Uint8Array): string { if (bytes.length === 4) return Array.from(bytes).join('.'); if (bytes.length === 16) { const groups: string[] = []; for (let index = 0; index < 16; index += 2) groups.push(((bytes[index]! << 8) | bytes[index + 1]!).toString(16)); return groups.join(':') } return formatHexBytes(bytes, false, 'none') }

function parseExtensions(node: Node, output: CertificateInspection): void {
  const wrapper = children(node)[0]; if (!wrapper) return
  for (const extension of children(expect(wrapper, 16, 'extensions'))) {
    const fields = children(expect(extension, 16, 'extension')); const id = oid(fields[0]!); const octets = fields.find((item) => item.tagClass === 0 && item.tag === 4)
    if (!octets) { output.undecodedExtensionOids.push(id); continue }
    try {
      const inner = readNode(value(octets), 0)
      if (id === '2.5.29.17') for (const name of children(expect(inner, 16, 'subjectAltName'))) {
        if (name.tagClass !== 2) continue
        if (name.tag === 2) output.subjectAlternativeNames.push({ type: 'DNS', value: decoder.decode(value(name)) })
        else if (name.tag === 1) output.subjectAlternativeNames.push({ type: 'Email', value: decoder.decode(value(name)) })
        else if (name.tag === 7) output.subjectAlternativeNames.push({ type: 'IP', value: parseIp(value(name)) })
      } else if (id === '2.5.29.19') {
        const parts = children(expect(inner, 16, 'basicConstraints')); const flag = parts.find((item) => item.tagClass === 0 && item.tag === 1); const length = parts.find((item) => item.tagClass === 0 && item.tag === 2)
        output.basicConstraints = { ca: flag ? value(flag)[0] !== 0 : false, pathLength: length ? integerNumber(length) : undefined }
      } else if (id === '2.5.29.15') {
        const bits = value(expect(inner, 3, 'keyUsage')); const names = ['Digital signature', 'Content commitment', 'Key encipherment', 'Data encipherment', 'Key agreement', 'Certificate signing', 'CRL signing', 'Encipher only', 'Decipher only']
        for (let bit = 0; bit < names.length; bit++) if ((bits[1 + Math.floor(bit / 8)]! & (128 >> (bit % 8))) !== 0) output.keyUsage.push(names[bit]!)
      } else if (id === '2.5.29.37') for (const usage of children(expect(inner, 16, 'extendedKeyUsage'))) { const usageOid = oid(usage); output.extendedKeyUsage.push(EKU[usageOid] ?? usageOid) }
      else output.undecodedExtensionOids.push(id)
    } catch { output.undecodedExtensionOids.push(id) }
  }
}

function base64ToDer(input: string): { der: Uint8Array; pemBlockCount: number } {
  const blocks = [...input.matchAll(/-----BEGIN (CERTIFICATE|CERTIFICATE REQUEST|PUBLIC KEY)-----([\s\S]*?)-----END \1-----/gu)]
  const selected = blocks.find((match) => match[1] === 'CERTIFICATE') ?? blocks[0]
  const body = (selected?.[2] ?? input).replace(/\s/gu, '')
  if (!body || !/^[A-Za-z0-9+/]*={0,2}$/u.test(body) || body.length % 4 === 1) throw new Error('Invalid Base64 input')
  try { const binary = atob(body); return { der: Uint8Array.from(binary, (character) => character.charCodeAt(0)), pemBlockCount: blocks.length } } catch { throw new Error('Invalid Base64 input') }
}
export function decodeCertificateInput(input: string): CertificateResult | { ok: true; value: { der: Uint8Array; pemBlockCount: number } } {
  try { return { ok: true, value: base64ToDer(input) } } catch (error) { return { ok: false, error: { code: 'invalid-input', message: error instanceof Error ? error.message : 'Invalid certificate input' } } }
}
async function fingerprint(algorithm: 'SHA-1' | 'SHA-256', der: Uint8Array): Promise<string | undefined> {
  if (!globalThis.crypto?.subtle) return undefined
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest(algorithm, der as Uint8Array<ArrayBuffer>))
  return formatHexBytes(digest, true, 'none').match(/.{2}/gu)?.join(':')
}

export async function inspectCertificate(input: string, now = Date.now()): Promise<CertificateResult> {
  try {
    const decoded = base64ToDer(input); const root = expect(readNode(decoded.der, 0), 16, 'certificate')
    if (root.end !== decoded.der.length) throw new Error('Trailing data after certificate')
    const certificate = children(root); const tbs = children(expect(certificate[0], 16, 'TBSCertificate'))
    let index = 0; let version = 1
    if (tbs[index]?.tagClass === 2 && tbs[index]?.tag === 0) { version = integerNumber(children(tbs[index]!)[0]!) + 1; index++ }
    const serial = tbs[index++]!; const signature = parseAlgorithm(tbs[index++]!); const issuerNode = tbs[index++]!; const validityNode = tbs[index++]!; const subjectNode = tbs[index++]!; const spki = children(expect(tbs[index++]!, 16, 'subjectPublicKeyInfo'))
    const times = children(expect(validityNode, 16, 'validity')); const notBefore = parseTime(times[0]!); const notAfter = parseTime(times[1]!); const delta = now < notBefore ? notBefore - now : now > notAfter ? now - notAfter : notAfter - now
    const keyAlgorithm = parseAlgorithm(spki[0]!); const keyBits = value(expect(spki[1], 3, 'public key')); let keySize: number | undefined
    if (keyAlgorithm.oid === '1.2.840.113549.1.1.1' && keyBits.length > 1) { const rsa = children(expect(readNode(keyBits.subarray(1), 0), 16, 'RSA public key')); let modulus = value(expect(rsa[0], 2, 'RSA modulus')); if (modulus[0] === 0) modulus = modulus.subarray(1); keySize = modulus.length * 8 }
    else if (keyAlgorithm.oid === '1.2.840.10045.2.1' && keyBits.length > 1) keySize = (keyBits.length - 2) * 4
    const output: CertificateInspection = {
      der: decoded.der, pemBlockCount: decoded.pemBlockCount, version, serialHex: integerHex(serial), signatureAlgorithm: signature,
      issuer: parseName(issuerNode), subject: parseName(subjectNode),
      validity: { notBefore, notAfter, notBeforeFormatted: convertTimestamp(notBefore), notAfterFormatted: convertTimestamp(notAfter), state: now < notBefore ? 'before' : now > notAfter ? 'after' : 'within', days: Math.ceil(delta / 86_400_000) },
      publicKey: { algorithmOid: keyAlgorithm.oid, algorithm: keyAlgorithm.name, keySize, curve: keyAlgorithm.parameters?.tag === 6 ? CURVES[oid(keyAlgorithm.parameters)] ?? oid(keyAlgorithm.parameters) : undefined },
      keyUsage: [], extendedKeyUsage: [], subjectAlternativeNames: [], undecodedExtensionOids: [], basicConstraints: undefined,
      fingerprints: {},
    }
    const extensions = tbs.find((item) => item.tagClass === 2 && item.tag === 3); if (extensions) parseExtensions(extensions, output)
    const [sha1, sha256] = await Promise.all([fingerprint('SHA-1', decoded.der), fingerprint('SHA-256', decoded.der)]); output.fingerprints = { sha1, sha256 }
    return { ok: true, value: output }
  } catch (error) { return { ok: false, error: { code: 'parse-error', message: error instanceof Error ? error.message : 'Unable to parse certificate' } } }
}
