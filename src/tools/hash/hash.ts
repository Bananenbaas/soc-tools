export type HashAlgorithm = 'MD5' | 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'

export function parseHexBytes(value: string): Uint8Array {
  const compact = value.replace(/\s/gu, '')
  if (compact.length % 2 !== 0) throw new Error('Odd-length hex input')
  if (!/^[0-9a-f]*$/iu.test(compact)) throw new Error('Invalid hex input')
  return Uint8Array.from(compact.match(/.{2}/gu) ?? [], (pair) => Number.parseInt(pair, 16))
}

function rotateLeft(value: number, amount: number): number { return (value << amount) | (value >>> (32 - amount)) }
function add(...values: number[]): number { return values.reduce((sum, value) => (sum + value) | 0, 0) }

export function md5(bytes: Uint8Array): string {
  const length = bytes.length
  const paddedLength = (((length + 8) >>> 6) + 1) * 64
  const data = new Uint8Array(paddedLength)
  data.set(bytes); data[length] = 0x80
  const bitLength = BigInt(length) * 8n
  for (let index = 0; index < 8; index += 1) data[paddedLength - 8 + index] = Number((bitLength >> BigInt(index * 8)) & 0xffn)
  let a0 = 0x67452301; let b0 = 0xefcdab89; let c0 = 0x98badcfe; let d0 = 0x10325476
  const shifts = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21]
  const constants = Array.from({ length: 64 }, (_, index) => Math.floor(Math.abs(Math.sin(index + 1)) * 0x100000000) | 0)
  for (let offset = 0; offset < paddedLength; offset += 64) {
    const words = new Int32Array(16)
    for (let index = 0; index < 16; index += 1) words[index] = data[offset + index * 4] | (data[offset + index * 4 + 1] << 8) | (data[offset + index * 4 + 2] << 16) | (data[offset + index * 4 + 3] << 24)
    let a = a0; let b = b0; let c = c0; let d = d0
    for (let index = 0; index < 64; index += 1) {
      let f: number; let g: number
      if (index < 16) { f = (b & c) | (~b & d); g = index }
      else if (index < 32) { f = (d & b) | (~d & c); g = (5 * index + 1) % 16 }
      else if (index < 48) { f = b ^ c ^ d; g = (3 * index + 5) % 16 }
      else { f = c ^ (b | ~d); g = (7 * index) % 16 }
      const nextD = d; d = c; c = b; b = add(b, rotateLeft(add(a, f, constants[index], words[g]), shifts[index])); a = nextD
    }
    a0 = add(a0, a); b0 = add(b0, b); c0 = add(c0, c); d0 = add(d0, d)
  }
  return [a0, b0, c0, d0].map((word) => Array.from({ length: 4 }, (_, index) => ((word >>> (index * 8)) & 0xff).toString(16).padStart(2, '0')).join('')).join('')
}

function toHex(buffer: ArrayBuffer): string { return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('') }

export async function computeHashes(input: string, mode: 'text' | 'hex' = 'text'): Promise<Record<HashAlgorithm, string>> {
  const bytes = mode === 'text' ? new TextEncoder().encode(input) : parseHexBytes(input)
  const digestInput = new Uint8Array(bytes)
  const algorithms = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const
  const digests = await Promise.all(algorithms.map(async (algorithm) => [algorithm, toHex(await crypto.subtle.digest(algorithm, digestInput))] as const))
  return { MD5: md5(bytes), ...Object.fromEntries(digests) } as Record<HashAlgorithm, string>
}
