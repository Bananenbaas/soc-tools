import { describe, expect, it } from 'vitest'
import { calculateCidr, classifyIp, compressIpv6, expandIpv6, integerToIpv4, ipv4ToInteger, isIpInCidr, parseIp } from './ipcidr'

describe('IP & CIDR Helper', () => {
  it('calculates an IPv4 /24', () => {
    expect(calculateCidr('10.0.0.0/24')).toMatchObject({ network: '10.0.0.0', broadcast: '10.0.0.255', firstUsable: '10.0.0.1', lastUsable: '10.0.0.254', usableCount: '254', netmask: '255.255.255.0', wildcard: '0.0.0.255' })
  })
  it('uses host defaults and handles /31 and /32 host counts', () => {
    expect(parseIp('192.0.2.7').prefixLength).toBe(32)
    expect(calculateCidr('192.0.2.4/31').usableCount).toBe('2')
    expect(calculateCidr('192.0.2.4/32').usableCount).toBe('1')
  })
  it('checks IPv4 membership', () => {
    expect(isIpInCidr('10.0.0.5', '10.0.0.0/24')).toBe(true)
    expect(isIpInCidr('10.0.1.5', '10.0.0.0/24')).toBe(false)
  })
  it('calculates, expands, and counts an IPv6 /48', () => {
    const result = calculateCidr('2001:db8::/48')
    expect(result.networkExpanded).toBe('2001:0db8:0000:0000:0000:0000:0000:0000')
    expect(result.lastAddress).toBe('2001:db8:0:ffff:ffff:ffff:ffff:ffff')
    expect(result.totalAddresses).toBe('1208925819614629174706176')
  })
  it('expands and compresses IPv6', () => {
    expect(expandIpv6('2001:db8::1')).toBe('2001:0db8:0000:0000:0000:0000:0000:0001')
    expect(compressIpv6('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe('2001:db8::1')
  })
  it('checks IPv6 membership with bigint comparison', () => {
    expect(isIpInCidr('2001:db8:abcd::1', '2001:db8::/32')).toBe(true)
    expect(isIpInCidr('2001:db9::1', '2001:db8::/32')).toBe(false)
  })
  it.each([
    ['10.1.2.3', 'private', '10.0.0.0/8'], ['8.8.8.8', 'global unicast (public)', '0.0.0.0/0 (no listed special-use range matched)'],
    ['127.0.0.1', 'loopback', '127.0.0.0/8'], ['fe80::1', 'link-local', 'fe80::/10'], ['2001:db8::1', 'documentation', '2001:db8::/32'],
  ])('classifies %s factually', (address, kind, matchedRange) => expect(classifyIp(address)).toEqual({ kind, matchedRange }))
  it('converts IPv4 to an integer and back', () => expect(integerToIpv4(ipv4ToInteger('192.0.2.1'))).toBe('192.0.2.1'))
  it.each(['999.1.1.1', '01.2.3.4', '2001:::1', '2001:db8::/129', '10.0.0.1/33', ''])('rejects invalid input %j', (input) => expect(() => parseIp(input)).toThrow())
  it('rejects mismatched membership versions and prefixed membership IPs', () => {
    expect(() => isIpInCidr('10.0.0.1', '2001:db8::/32')).toThrow()
    expect(() => isIpInCidr('10.0.0.1/32', '10.0.0.0/8')).toThrow()
  })
})
