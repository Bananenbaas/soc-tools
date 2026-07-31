import { describe, expect, it } from 'vitest'
import { convertFiletime, convertGuid, convertIntegrityLevel, convertLogonType, convertSid, convertWebkitTime, decodeAccessMask, sidToBinary } from './winartifacts'

describe('Windows artifact converters', () => {
  it.each([
    ['S-1-5-18', '010100000000000512000000'],
    ['S-1-5-21-3623811015-3361044348-30300820-1013', '010500000000000515000000c7f7fed77c7755c8945ace01f5030000'],
  ])('round-trips SID %s', (sid, hex) => {
    expect(sidToBinary(sid)).toEqual({ sid, hex })
    expect(convertSid(hex)).toEqual({ sid, hex })
  })

  it('converts GUID mixed-endian byte order in both directions', () => {
    const canonical = '{00112233-4455-6677-8899-aabbccddeeff}'
    const binaryHex = '33221100554477668899aabbccddeeff'
    expect(convertGuid(canonical)).toEqual({ canonical, binaryHex })
    expect(convertGuid(binaryHex)).toEqual({ canonical, binaryHex })
  })

  it('converts FILETIME and recognizes both never sentinels', () => {
    const result = convertFiletime('132223104000000000')
    expect(result.kind === 'date' && result.timestamp.iso).toBe('2020-01-01T00:00:00.000Z')
    expect(convertFiletime('0')).toEqual({ kind: 'never', label: 'Never' })
    expect(convertFiletime('0x7FFFFFFFFFFFFFFF')).toEqual({ kind: 'never', label: 'Never' })
  })

  it('converts a Chrome/WebKit microsecond timestamp', () => {
    const result = convertWebkitTime('13222310400000000')
    expect(result.kind === 'date' && result.timestamp.iso).toBe('2020-01-01T00:00:00.000Z')
  })

  it('decodes FILE_GENERIC_READ 0x120089', () => {
    const names = decodeAccessMask('0x120089').flags.map((flag) => flag.name)
    expect(names).toEqual(expect.arrayContaining(['SYNCHRONIZE', 'READ_CONTROL', 'FILE_READ_ATTRIBUTES / KEY_ENUMERATE_SUB_KEYS', 'FILE_READ_EA / KEY_QUERY_VALUE', 'FILE_READ_DATA / FILE_LIST_DIRECTORY']))
  })

  it('maps logon type 10 and integrity levels', () => {
    expect(convertLogonType('10').label).toBe('RemoteInteractive')
    expect(convertIntegrityLevel('12288').label).toBe('High')
    expect(convertIntegrityLevel('S-1-16-16384').label).toBe('System')
  })
})
