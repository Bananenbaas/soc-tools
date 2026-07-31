import { describe, expect, it } from 'vitest'
import { computeHashes, md5, parseHexBytes } from './hash'

describe('Hashes', () => {
  it.each([['', 'd41d8cd98f00b204e9800998ecf8427e'], ['abc', '900150983cd24fb0d6963f7d28e17f72']])('computes MD5 for %j', (plain, digest) => {
    expect(md5(new TextEncoder().encode(plain))).toBe(digest)
  })
  it('computes native Web Crypto vectors for abc', async () => {
    const hashes = await computeHashes('abc')
    expect(hashes['SHA-1']).toBe('a9993e364706816aba3e25717850c26c9cd0d89d')
    expect(hashes['SHA-256']).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(hashes['SHA-384']).toBe('cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7')
    expect(hashes['SHA-512']).toBe('ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f')
  })
  it('accepts hex bytes and rejects malformed hex', async () => {
    expect((await computeHashes('616263', 'hex')).MD5).toBe('900150983cd24fb0d6963f7d28e17f72')
    expect(() => parseHexBytes('abc')).toThrow('Odd-length')
    expect(() => parseHexBytes('zz')).toThrow('Invalid hex')
  })
})
