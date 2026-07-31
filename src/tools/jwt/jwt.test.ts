import { describe, expect, it } from 'vitest'
import { formatJwtInspection, inspectJwt } from './jwt'

describe('JWT inspection', () => {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
  it('decodes the jwt.io HS256 example without verifying it', () => {
    const result = inspectJwt(token)
    expect(result.header).toEqual({ alg: 'HS256', typ: 'JWT' })
    expect(result.payload).toMatchObject({ sub: '1234567890', name: 'John Doe', iat: 1516239022 })
    expect(result.timestamps.iat?.raw).toBe(1516239022)
    expect(formatJwtInspection(result)).toContain('Europe/Amsterdam')
  })
  it.each(['abc', 'a.b.', '%%%.e30.sig', 'e30.bm90LWpzb24.sig'])('rejects malformed token %j', (value) => {
    expect(() => inspectJwt(value)).toThrow()
  })
})
