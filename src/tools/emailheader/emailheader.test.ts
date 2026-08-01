import { describe, expect, it } from 'vitest'
import { decodeMimeWords, parseEmailHeader, parseHeaders } from './emailheader'

const RAW_HEADER = `Received: from mx.example.net (mx.example.net [198.51.100.20])
\tby inbound.recipient.test with ESMTPS; Tue, 15 Jul 2025 12:02:30 +0200
Received: from sender.example.org (sender.example.org [203.0.113.42])
 by mx.example.net with ESMTP; Tue, 15 Jul 2025 10:00:00 +0000
Authentication-Results: inbound.recipient.test;
 spf=pass smtp.mailfrom=bounces.example.org;
 dkim=fail header.d=example.org; dmarc=none header.from=example.com
ARC-Authentication-Results: i=1; arc=pass; spf=pass smtp.mailfrom=bounces.example.org
Received-SPF: pass (recipient.test: domain permits 203.0.113.42)
From: =?UTF-8?Q?Jos=C3=A9_Analyst?= <jose@example.com>
To: SOC Team <soc@recipient.test>
Return-Path: <bounce@mailer.example.org>
Reply-To: help@example.com
Subject: =?UTF-8?B?UGhpc2hpbmcgdHJpYWdl?=
Message-ID: <case-123@mail.example.com>
Date: Tue, 15 Jul 2025 10:00:00 +0000`

describe('email header parser', () => {
  it('unfolds continuation lines and preserves duplicate headers in order', () => {
    const headers = parseHeaders(RAW_HEADER)
    expect(headers.filter((header) => header.name.toLowerCase() === 'received')).toHaveLength(2)
    expect(headers[0].value).toContain('by inbound.recipient.test with ESMTPS')
    expect(headers[2].value).toContain('spf=pass smtp.mailfrom=bounces.example.org; dkim=fail')
  })

  it('orders Received hops origin to delivery and computes timestamps and delays', () => {
    const result = parseEmailHeader(RAW_HEADER)
    expect(result.hops.map((hop) => [hop.fromHost, hop.byHost])).toEqual([
      ['sender.example.org', 'mx.example.net'],
      ['mx.example.net', 'inbound.recipient.test'],
    ])
    expect(result.hops.map((hop) => hop.timestamp?.epochMs)).toEqual([Date.parse('2025-07-15T10:00:00Z'), Date.parse('2025-07-15T10:02:30Z')])
    expect(result.hops[0].delayToNextMs).toBe(150_000)
    expect(result.totalTransitMs).toBe(150_000)
    expect(result.hops[0].timestamp?.utc).toContain('10:00:00')
    expect(result.hops[0].timestamp?.amsterdam).toContain('12:00:00')
  })

  it('parses reported authentication statuses', () => {
    const summary = parseEmailHeader(RAW_HEADER).authentication.summary
    expect(summary.spf).toEqual(['pass'])
    expect(summary.dkim).toEqual(['fail'])
    expect(summary.dmarc).toEqual(['none'])
    expect(summary.arc).toEqual(['pass'])
  })

  it('decodes Base64 and Q MIME encoded-word subjects', () => {
    expect(decodeMimeWords('=?UTF-8?B?UGhpc2hpbmcgdHJpYWdl?=')).toBe('Phishing triage')
    expect(decodeMimeWords('=?UTF-8?Q?Factuur_=E2=82=AC_42?=')).toBe('Factuur € 42')
  })

  it('reports factual domain differences and extracts the sending IP', () => {
    const result = parseEmailHeader(RAW_HEADER)
    expect(result.notes).toContainEqual({ kind: 'domain-mismatch', domains: ['example.com', 'mailer.example.org'] })
    expect(result.iocs.groups.find((group) => group.type === 'ipv4')?.entries.map((entry) => entry.value)).toContain('203.0.113.42')
  })
})
