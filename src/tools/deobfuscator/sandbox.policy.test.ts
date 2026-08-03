import { describe, expect, it } from 'vitest'
import { DEFAULT_SANDBOX_LIMITS, normalizeSandboxLimits, SANDBOX_LIMIT_POLICY, runInQuickJSSandbox } from './sandbox'
import { parseSandboxWorkerRequest } from './sandbox.worker'

describe('QuickJS sandbox resource policy', () => {
  it('clamps finite out-of-range limits and falls back for invalid values', () => {
    expect(normalizeSandboxLimits({ cpuTimeoutMs: 99_999, memoryLimitBytes: 1, stackLimitBytes: 99_999_999 })).toEqual({
      cpuTimeoutMs: SANDBOX_LIMIT_POLICY.cpuTimeoutMs.max,
      memoryLimitBytes: SANDBOX_LIMIT_POLICY.memoryLimitBytes.min,
      stackLimitBytes: SANDBOX_LIMIT_POLICY.stackLimitBytes.max,
    })
    expect(normalizeSandboxLimits({ cpuTimeoutMs: Number.NaN, memoryLimitBytes: -1, stackLimitBytes: Number.POSITIVE_INFINITY })).toEqual(DEFAULT_SANDBOX_LIMITS)
  })

  it('rejects malformed worker requests and normal requests still run', async () => {
    expect(parseSandboxWorkerRequest({ code: '1', limits: { cpuTimeoutMs: Number.NaN } })).toMatchObject({ error: 'runtime' })
    expect(parseSandboxWorkerRequest({ code: '1', limits: { cpuTimeoutMs: 99_999 } })).toMatchObject({ code: '1', limits: { cpuTimeoutMs: SANDBOX_LIMIT_POLICY.cpuTimeoutMs.max } })
    const result = await runInQuickJSSandbox('console.log(1)')
    expect(result.error, result.detail).toBeUndefined()
    expect(result.console).toEqual(['1'])
  })
})
