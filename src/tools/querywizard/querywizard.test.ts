import { describe, expect, it } from 'vitest'
import { Window } from 'happy-dom'
import { dialects, extractIocValues, generateSigma, generateWazuh, type QuerySpec } from './querywizard'

const spec: QuerySpec = {
  dataSource: 'security',
  conditions: [
    { field: 'UserName', op: 'equals', value: 'alice' },
    { field: 'src_ip', op: 'in', value: ['192.0.2.1', '198.51.100.2'] },
  ],
  combinator: 'AND',
  timeWindow: { kind: 'relative', last: '24h' },
}

const generated = () => Object.fromEntries(dialects.map((dialect) => [dialect.id, dialect.generate(spec)]))

describe('SIEM query dialects', () => {
  it('generates the expected basic syntax for every query dialect', () => {
    expect(generated()).toEqual({
      splunk: 'index=security UserName="alice" AND src_ip IN ("192.0.2.1","198.51.100.2") earliest=-24h',
      kusto: 'security | where UserName == "alice" and src_ip in ("192.0.2.1","198.51.100.2") | where Timestamp > ago(24h)',
      'elastic-kql': 'UserName : "alice" and src_ip : ("192.0.2.1" or "198.51.100.2") and @timestamp >= now-24h',
      'elastic-eql': 'security where UserName == "alice" and src_ip in ("192.0.2.1","198.51.100.2") and @timestamp > now() - 24h',
      lucene: 'UserName:"alice" AND src_ip:("192.0.2.1" OR "198.51.100.2") AND @timestamp:[now-24h TO now]',
      grep: "grep -E 'alice|192\\.0\\.2\\.1|198\\.51\\.100\\.2'",
    })
  })

  it('escapes quotes, backslashes, regex metacharacters, YAML, and XML', () => {
    const special: QuerySpec = { conditions: [{ field: 'message', op: 'equals', value: 'a"b\\c.* <tag> & it\'s' }], combinator: 'AND' }
    for (const dialect of dialects.filter((item) => item.id !== 'grep')) expect(dialect.generate(special)).toContain('"a\\"b\\\\c.* <tag> & it\'s"')
    expect(dialects.find((item) => item.id === 'grep')?.generate(special)).toContain('\\.\\*')
    expect(generateSigma(special)).toContain("it''s")
    expect(generateWazuh(special)).toContain('&lt;tag&gt; &amp; it&apos;s')
  })

  it('creates rule skeletons with required keys and well-formed XML', () => {
    const sigma = generateSigma(spec)
    expect(sigma).toMatch(/^title:/u)
    for (const key of ['status: experimental', 'logsource:', 'detection:', 'selection:', 'condition: selection', 'falsepositives:', 'level:']) expect(sigma).toContain(key)
    const xml = generateWazuh(spec)
    const window = new Window()
    const document = new window.DOMParser().parseFromString(xml, 'application/xml')
    expect(document.querySelector('parsererror')).toBeNull()
    expect(document.documentElement.tagName).toBe('rule')
  })

  it('keeps Sigma negation and OR structure semantically visible', () => {
    const notEqual = generateSigma({ conditions: [{ field: 'user', op: 'not_equals', value: 'admin' }], combinator: 'AND' })
    expect(notEqual).toContain('filter1:')
    expect(notEqual).toContain('selection: {}')
    expect(notEqual).toContain('condition: selection and not filter1')
    expect(notEqual).not.toContain('selection:\n    user:')
    const or = generateSigma({ conditions: [{ field: 'user', op: 'equals', value: 'alice' }, { field: 'ip', op: 'equals', value: '192.0.2.1' }], combinator: 'OR' })
    expect(or).toContain('selection1:')
    expect(or).toContain('selection2:')
    expect(or).toContain('condition: 1 of selection*')
  })

  it('replaces unsafe identifiers in copied query text', () => {
    const unsafe: QuerySpec = { dataSource: 'Table | drop table X', conditions: [{ field: 'foo] OR *', op: 'equals', value: 'x' }], combinator: 'AND' }
    for (const id of ['splunk', 'kusto', 'elastic-kql', 'elastic-eql', 'lucene']) {
      const output = dialects.find((dialect) => dialect.id === id)?.generate(unsafe) ?? ''
      expect(output).not.toContain('Table | drop table X')
      expect(output).not.toContain('foo] OR *')
    }
  })

  it('turns a pasted IOC list into SPL and KQL IN-lists', () => {
    const values = extractIocValues('192.0.2.1\n198.51.100.2')
    const iocSpec: QuerySpec = { conditions: [{ field: 'src_ip', op: 'in', value: values }], combinator: 'AND' }
    expect(dialects.find((item) => item.id === 'splunk')?.generate(iocSpec)).toBe('src_ip IN ("192.0.2.1","198.51.100.2")')
    expect(dialects.find((item) => item.id === 'kusto')?.generate(iocSpec)).toBe('TableName | where src_ip in ("192.0.2.1","198.51.100.2")')
  })
})
