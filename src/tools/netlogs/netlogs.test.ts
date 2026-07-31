import { describe, expect, it } from 'vitest'
import { filterNetLogs, parseNetLogs } from './netlogs'

const zeekTsv = `#separator \\x09
#set_separator\t,
#fields\tts\tuid\tid.orig_h\tid.orig_p\tid.resp_h\tid.resp_p\tproto\tservice\tduration\torig_bytes\tresp_bytes
#types\ttime\tstring\taddr\tport\taddr\tport\tenum\tstring\tinterval\tcount\tcount
1710000000.5\tC1\t10.0.0.2\t52144\t93.184.216.34\t443\ttcp\tssl\t1.25\t120\t340`

describe('Zeek and Suricata log exploration', () => {
  it('maps a real Zeek conn.log TSV header and summarizes its flow', () => {
    const result = parseNetLogs(zeekTsv)
    expect(result.format).toBe('zeek-tsv')
    expect(result.records[0]).toMatchObject({ src_ip: '10.0.0.2', dest_port: 443, timestampUtc: '2024-03-09T16:00:00.500Z' })
    expect(result.flows[0]).toMatchObject({ count: 1, bytes: 460, dest_port: 443 })
  })

  it('parses equivalent Zeek JSON connection data', () => {
    const result = parseNetLogs('{"ts":1710000000.5,"id.orig_h":"10.0.0.2","id.orig_p":52144,"id.resp_h":"93.184.216.34","id.resp_p":443,"proto":"tcp","service":"ssl","orig_bytes":120,"resp_bytes":340}')
    expect(result.format).toBe('zeek-json')
    expect(result.records[0]).toMatchObject({ src_ip: '10.0.0.2', dest_ip: '93.184.216.34', dest_port: 443, timestampUtc: '2024-03-09T16:00:00.500Z' })
  })

  it('surfaces a Suricata alert and DNS domain', () => {
    const input = [
      '{"timestamp":"2024-03-09T17:00:00.000+01:00","event_type":"alert","src_ip":"10.0.0.2","src_port":52144,"dest_ip":"93.184.216.34","dest_port":443,"proto":"TCP","alert":{"signature":"TLS policy match","category":"Policy"}}',
      '{"timestamp":"2024-03-09T16:00:01.000Z","event_type":"dns","src_ip":"10.0.0.2","dest_ip":"8.8.8.8","dest_port":53,"proto":"UDP","dns":{"rrname":"example.org"}}',
    ].join('\n')
    const result = parseNetLogs(input)
    expect(result.records[0]).toMatchObject({ alert_signature: 'TLS policy match', dest_port: 443, proto: 'tcp' })
    expect(result.unique.domains).toContainEqual({ value: 'example.org', count: 1 })
  })

  it('collects JA3 and JA3S values from TLS events', () => {
    const result = parseNetLogs('{"timestamp":"2024-03-09T16:00:00Z","event_type":"tls","src_ip":"10.0.0.2","dest_ip":"1.1.1.1","tls":{"ja3":{"hash":"abc123"},"ja3s":"server456"}}')
    expect(result.unique.ja3).toEqual([{ value: 'abc123', count: 1 }, { value: 'server456', count: 1 }])
  })

  it('skips malformed lines and applies a field filter', () => {
    const input = '{"ts":1710000000,"id.resp_p":80,"proto":"tcp"}\nnot json\n{"ts":1710000001,"id.resp_p":443,"proto":"tcp"}'
    const result = parseNetLogs(input)
    expect(result.skippedCount).toBe(1)
    expect(filterNetLogs(result.records, 'dest_port=443')).toHaveLength(1)
  })
})
