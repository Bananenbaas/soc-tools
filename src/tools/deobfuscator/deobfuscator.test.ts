import { describe, expect, it, vi } from 'vitest'
import { deobfuscateStatic } from './deobfuscator'
import { runInQuickJSSandbox } from './sandbox'

describe('static JavaScript deobfuscation', () => {
  it('peels Base64 without eval', () => {
    const evalSpy = vi.spyOn(globalThis, 'eval')
    const result = deobfuscateStatic('Y29uc29sZS5sb2coImhpIik7')
    expect(result.output).toBe('console.log("hi");')
    expect(result.steps).toContain('base64')
    expect(evalSpy).not.toHaveBeenCalled()
    evalSpy.mockRestore()
  })

  it('decodes hexadecimal and Unicode escapes', () => {
    const result = deobfuscateStatic('\\x61\\u006c\\u65rt')
    expect(result.output).toBe('alert')
    expect(result.steps).toContain('escapes')
  })

  it('folds String.fromCharCode sequences', () => {
    const result = deobfuscateStatic('eval(String.fromCharCode(97,108,101,114,116,40,49,41))')
    expect(result.output).toBe("eval('alert(1)')")
    expect(result.steps).toContain('fromCharCode')
  })

  it('unpacks a Dean Edwards payload as data', () => {
    const packed = "eval(function(p,a,c,k,e,d){e=function(c){return c.toString(a)};if(!''.replace(/^/,String)){while(c--)d[c.toString(a)]=k[c]||c.toString(a);k=[function(e){return d[e]}];e=function(){return'\\\\w+'};c=1};while(c--)if(k[c])p=p.replace(new RegExp('\\\\b'+e(c)+'\\\\b','g'),k[c]);return p}('0(\\\"1\\\")',2,2,'alert|hello'.split('|'),0,{}))"
    const result = deobfuscateStatic(packed)
    expect(result.output).toBe('alert("hello")')
    expect(result.steps).toContain('dean-edwards')
  })
})

describe('QuickJS sandbox', () => {
  it('captures the JSFuck Function-constructor path without executing its body', async () => {
    const result = await runInQuickJSSandbox('[]["filter"]["constructor"]("globalThis.sideEffect=1;alert(1)")(); console.log(typeof sideEffect)')
    expect(result.error, result.detail).toBeUndefined()
    expect(result.captured).toEqual(['globalThis.sideEffect=1;alert(1)'])
    expect(result.console).toEqual(['undefined'])
  })

  it('interrupts an infinite loop', async () => {
    const started = Date.now()
    const result = await runInQuickJSSandbox('while(1){}', { cpuTimeoutMs: 50, memoryLimitBytes: 16 * 1024 * 1024, stackLimitBytes: 512 * 1024 })
    expect(result.error).toBe('timeout')
    expect(Date.now() - started).toBeLessThan(2_000)
  })

  it('contains an allocation bomb', async () => {
    const result = await runInQuickJSSandbox('globalThis.bomb = new Array(100000000).fill(1)', { cpuTimeoutMs: 2_000, memoryLimitBytes: 4 * 1024 * 1024, stackLimitBytes: 512 * 1024 })
    expect(result.error, result.detail).toBe('memory')
  })

  it('does not expose browser, network, or Node host objects', async () => {
    const result = await runInQuickJSSandbox('console.log(typeof fetch, typeof XMLHttpRequest, typeof process, typeof window)')
    expect(result.console).toEqual(['undefined undefined undefined undefined'])
  })
})
