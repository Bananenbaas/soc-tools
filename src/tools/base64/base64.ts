export type Base64Variant = 'base64' | 'base64url'

function bytesToBinary(bytes: Uint8Array): string {
  let output = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    output += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return output
}

export function encodeBase64(value: string, variant: Base64Variant = 'base64'): string {
  const encoded = btoa(bytesToBinary(new TextEncoder().encode(value)))
  return variant === 'base64url'
    ? encoded.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
    : encoded
}

export function decodeBase64(value: string, variant: Base64Variant = 'base64'): string {
  const compact = value.replace(/\s/gu, '')
  const alphabet = variant === 'base64url' ? /^[A-Za-z0-9_-]*={0,2}$/u : /^[A-Za-z0-9+/]*={0,2}$/u
  if (!alphabet.test(compact) || compact.length % 4 === 1) throw new Error('Invalid Base64')

  const standard = (variant === 'base64url' ? compact.replaceAll('-', '+').replaceAll('_', '/') : compact).replace(/=+$/u, '')
  const padded = standard.padEnd(Math.ceil(standard.length / 4) * 4, '=')
  let binary: string
  try {
    binary = atob(padded)
  } catch {
    throw new Error('Invalid Base64')
  }

  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error('Invalid UTF-8')
  }
}
