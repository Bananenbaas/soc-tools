import { describe, expect, it } from 'vitest'
import { decodeCertificateInput, inspectCertificate, keySizeForCurve, parseCertificateTimeValue } from './certificate'

const CERTIFICATE_PEM = `-----BEGIN CERTIFICATE-----
MIIEhTCCA22gAwIBAgIIASNFZ4mrze8wDQYJKoZIhvcNAQELBQAwgZwxCzAJBgNV
BAYTAk5MMRYwFAYDVQQIDA1Ob29yZC1Ib2xsYW5kMRIwEAYDVQQHDAlBbXN0ZXJk
YW0xEjAQBgNVBAoMCVNPQyBUb29sczEQMA4GA1UECwwHVGVzdGluZzEVMBMGA1UE
AwwMZXhhbXBsZS50ZXN0MSQwIgYJKoZIhvcNAQkBFhVzZWN1cml0eUBleGFtcGxl
LnRlc3QwHhcNMjYwODAxMDk1NDM5WhcNMzYwNzI5MDk1NDM5WjCBnDELMAkGA1UE
BhMCTkwxFjAUBgNVBAgMDU5vb3JkLUhvbGxhbmQxEjAQBgNVBAcMCUFtc3RlcmRh
bTESMBAGA1UECgwJU09DIFRvb2xzMRAwDgYDVQQLDAdUZXN0aW5nMRUwEwYDVQQD
DAxleGFtcGxlLnRlc3QxJDAiBgkqhkiG9w0BCQEWFXNlY3VyaXR5QGV4YW1wbGUu
dGVzdDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAKinlV/rh1i2VD3K
4bcKCxN/rGkWtwEI4y2s8J2eRCBjHUkTsUodY5yRIKREglIozmO1NKDWNo40AZ7d
xzRsix9FgIsy5FohfSbd6lFzU50wXysVq2uCN4PD02jAYTnBU7GekS824o2A7clr
5GIGB5XZ5BKRCjsvI8FRNixqrz0jt5O4urXeURXGdOQ9PPahIqNXpkQEryNwq1Zg
rS+coeDUqJ8WOUhxIHmrYgK5ZL+/e1cQUZqE7apuQY7t2qlNWbJhmyYy6O+Y6xA0
0SNAKnuMrmBRI8TKHDvK44h0lIHzkN0mqKB4/f8Mf6t1PjyNqF5HvhPxTXXevhqo
Gn3qcDkCAwEAAaOByDCBxTAdBgNVHQ4EFgQUmjPitulMH/eduKI1ywiLNnGgeOkw
HwYDVR0jBBgwFoAUmjPitulMH/eduKI1ywiLNnGgeOkwRgYDVR0RBD8wPYIMZXhh
bXBsZS50ZXN0ghB3d3cuZXhhbXBsZS50ZXN0hwTAAAIKgRVzZWN1cml0eUBleGFt
cGxlLnRlc3QwDAYDVR0TAQH/BAIwADAOBgNVHQ8BAf8EBAMCBaAwHQYDVR0lBBYw
FAYIKwYBBQUHAwEGCCsGAQUFBwMCMA0GCSqGSIb3DQEBCwUAA4IBAQA8PbaigPDc
IKOk5XF7DydVR/pyclOrSVscLOIejtfh3z5JL4VDMFl227XMkecja8apYecd2kpX
mQof4D3U0Hh2uVS6JjqhZYl8qKdo3cZ68Uxbdfk7Vx4hdHmBPaVv9rEcwoudqSPw
wltMd1jXhNtTb2xBv2H9vCq/3YcVB/zqkYocPT+uDdDXFnrJQrDlciel33V/VxQ6
TSQdBwPbdTTXNrjIpzySEFkFJc2r8rhM6Q4gUYgAIO9n+aNhHHY6OcMzilZebV9l
mYe/1G6Utn2GbDh2+Mr31Y2X4nxaHSptU59Cn/meDwS6w/jwgg6ns+mSJ+krZLpG
68JyrjqHRSv8
-----END CERTIFICATE-----`

describe('certificate inspector', () => {
  it('strips PEM armor and decodes DER', () => {
    const result = decodeCertificateInput(CERTIFICATE_PEM)
    expect(result.ok).toBe(true)
    if (result.ok) { expect(result.value.der[0]).toBe(0x30); expect(result.value.der.length).toBeGreaterThan(900); expect(result.value.pemBlockCount).toBe(1) }
  })
  it('maps named EC curves to their defined key sizes', () => {
    expect(keySizeForCurve('1.2.840.10045.3.1.7')).toBe(256)
    expect(keySizeForCurve('1.3.132.0.34')).toBe(384)
    expect(keySizeForCurve('1.2.3.4')).toBeUndefined()
    expect(parseCertificateTimeValue('240101000000Z', 23)).toBe(Date.UTC(2024, 0, 1))
  })

  it('rejects out-of-range certificate date components instead of normalizing them', () => {
    expect(() => parseCertificateTimeValue('20241301000000Z', 24)).toThrow('Invalid GeneralizedTime')
  })

  it('extracts X.509 identity, validity, serial, SANs, usages, and constraints', async () => {
    const result = await inspectCertificate(CERTIFICATE_PEM, Date.UTC(2027, 0, 1))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.subject.commonName).toBe('example.test')
    expect(result.value.issuer.commonName).toBe('example.test')
    expect(result.value.validity.notBefore).toBe(Date.UTC(2026, 7, 1, 9, 54, 39))
    expect(result.value.validity.notAfter).toBe(Date.UTC(2036, 6, 29, 9, 54, 39))
    expect(result.value.serialHex).toBe('01:23:45:67:89:AB:CD:EF')
    expect(result.value.subjectAlternativeNames).toEqual(expect.arrayContaining([
      { type: 'DNS', value: 'example.test' }, { type: 'DNS', value: 'www.example.test' },
      { type: 'IP', value: '192.0.2.10' }, { type: 'Email', value: 'security@example.test' },
    ]))
    expect(result.value.basicConstraints).toEqual({ ca: false, pathLength: undefined })
    expect(result.value.keyUsage).toEqual(expect.arrayContaining(['Digital signature', 'Key encipherment']))
    expect(result.value.extendedKeyUsage).toEqual(expect.arrayContaining(['TLS web server authentication', 'TLS web client authentication']))
  })

  it('computes a SHA-256 fingerprint over the same full DER bytes', async () => {
    if (!globalThis.crypto?.subtle) return
    const decoded = decodeCertificateInput(CERTIFICATE_PEM); const result = await inspectCertificate(CERTIFICATE_PEM)
    if (!decoded.ok || !result.ok) throw new Error('Fixture did not parse')
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', decoded.value.der as Uint8Array<ArrayBuffer>))
    const expected = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(':')
    expect(result.value.fingerprints.sha256).toBe(expected)
  })

  it('uses the first certificate and reports all recognized PEM blocks', async () => {
    const result = await inspectCertificate(`${CERTIFICATE_PEM}\n${CERTIFICATE_PEM}`)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.pemBlockCount).toBe(2)
  })

  it.each(['not base64!@', 'MIIE', CERTIFICATE_PEM.slice(0, -80)])('returns a structured error without throwing for malformed input', async (input) => {
    await expect(inspectCertificate(input)).resolves.toMatchObject({ ok: false, error: { code: expect.any(String), message: expect.any(String) } })
  })
})
