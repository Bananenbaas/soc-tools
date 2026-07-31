import { afterEach, describe, expect, it, vi } from 'vitest'
import { decodeBase64, encodeBase64 } from './base64/base64'
import { defang, refang } from './defang/defang'
import { computeHashes } from './hash/hash'
import { decodeHex, encodeHex } from './hex/hex'
import { formatJwtInspection, inspectJwt } from './jwt/jwt'
import { convertTimestamp, formatTimestampConversions, parseTimestamp } from './timestamp/timestamp'
import { decodeUrl, encodeUrl } from './url/url'

describe('client-side processing guarantee', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('uses no network API while every tool processes input', async () => {
    const fetch = vi.fn()
    const xhr = vi.fn()
    const webSocket = vi.fn()
    const sendBeacon = vi.fn()
    vi.stubGlobal('fetch', fetch)
    vi.stubGlobal('XMLHttpRequest', xhr)
    vi.stubGlobal('WebSocket', webSocket)
    vi.stubGlobal('navigator', { sendBeacon })

    expect(decodeBase64(encodeBase64('SOC'))).toBe('SOC')
    expect(decodeHex(encodeHex('SOC'))).toBe('SOC')
    expect(decodeUrl(encodeUrl('SOC tools'))).toBe('SOC tools')
    const jwt = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJhbmFseXN0In0.signature'
    expect(formatJwtInspection(inspectJwt(jwt))).toContain('analyst')
    expect(await computeHashes('SOC')).toHaveProperty('SHA-256')
    expect(refang(defang('https://example.com'))).toBe('https://example.com')
    expect(formatTimestampConversions(convertTimestamp(parseTimestamp('0', 'seconds')))).toContain('1970')

    expect(fetch).not.toHaveBeenCalled()
    expect(xhr).not.toHaveBeenCalled()
    expect(webSocket).not.toHaveBeenCalled()
    expect(sendBeacon).not.toHaveBeenCalled()
  })
})
