import { describe, expect, it } from 'vitest'
import { calculateJsonStats, escapeJsonString, flattenJson, inspectJson, sortJsonKeys, unescapeJsonString, type JsonValue } from './jsonfmt'

describe('JSON formatter and inspector', () => {
  it('pretty-prints with two, four, and tab indentation and round-trips', () => {
    const input = '{"a":{"b":1}}'
    expect(inspectJson(input, 'format', 2).output).toBe('{\n  "a": {\n    "b": 1\n  }\n}')
    expect(inspectJson(input, 'format', 4).output).toContain('\n    "a"')
    expect(inspectJson(input, 'format', '\t').output).toContain('\n\t"a"')
    expect(JSON.parse(inspectJson(input).output)).toEqual(JSON.parse(input))
  })

  it('minifies JSON without formatting whitespace', () => {
    expect(inspectJson('{ \n "a" : 1, "b": [ true ] }', 'minify').output).toBe('{"a":1,"b":[true]}')
  })

  it('locates invalid JSON', () => {
    const result = inspectJson('{\n  "a": 1,\n  "b": }')
    expect(result.valid).toBe(false)
    expect(result.error).toMatchObject({ line: 3, column: 8 })
    expect(result.error?.excerpt).toContain('"b": }')
  })

  it('sorts object keys recursively while retaining array order', () => {
    expect(sortJsonKeys({ z: { b: 1, a: 2 }, a: [{ d: 3, c: 4 }] })).toEqual({ a: [{ c: 4, d: 3 }], z: { a: 2, b: 1 } })
    expect(inspectJson('{"z":{"b":1,"a":2},"a":0}', 'sort').output.indexOf('"a": 0')).toBeLessThan(inspectJson('{"z":{"b":1,"a":2},"a":0}', 'sort').output.indexOf('"z"'))
  })

  it('detects and formats three JSONL records', () => {
    const result = inspectJson('{"id":1}\n{"id":2}\n{"id":3}', 'format')
    expect(result).toMatchObject({ valid: true, isJsonLines: true, recordCount: 3 })
    expect(result.output.split('\n').filter((line) => line === '}')).toHaveLength(3)
  })

  it('flattens nested objects and arrays with escaped complex keys', () => {
    const value = { a: { b: [{ c: 'x' }] }, 'dot.key': true } as JsonValue
    expect(flattenJson(value)).toBe('a.b[0].c = "x"\n["dot.key"] = true')
  })

  it('escapes and unescapes quotes, newlines, and Unicode inversely', () => {
    const raw = 'say "hi"\n雪'
    expect(unescapeJsonString(escapeJsonString(raw))).toBe(raw)
  })

  it('detects a JWT string and decodes its payload', () => {
    const token = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhbGljZSIsInJvbGUiOiJhbmFseXN0In0.'
    const result = inspectJson(JSON.stringify({ token }))
    expect(result.notes).toHaveLength(1)
    expect(result.notes[0]).toMatchObject({ path: 'token', kind: 'JWT' })
    expect(result.notes[0]?.preview).toContain('"role":"analyst"')
  })

  it('counts depth, keys, and value kinds for a known object', () => {
    const input = '{"a":{"b":[1,{"c":false}]},"d":null}'
    const value = JSON.parse(input) as JsonValue
    expect(calculateJsonStats([value], input)).toMatchObject({ maxDepth: 5, totalKeys: 4, objects: 3, arrays: 1, scalars: 3 })
  })
})
