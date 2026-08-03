import variant from '@jitl/quickjs-singlefile-browser-release-sync'
import { newQuickJSWASMModuleFromVariant, type QuickJSHandle } from 'quickjs-emscripten-core'

export interface SandboxLimits {
  cpuTimeoutMs: number
  memoryLimitBytes: number
  stackLimitBytes: number
}

export interface SandboxResult {
  captured: string[]
  console: string[]
  error?: 'timeout' | 'memory' | 'runtime'
  detail?: string
}

export const SANDBOX_LIMIT_POLICY = {
  cpuTimeoutMs: { min: 10, max: 10_000 },
  memoryLimitBytes: { min: 1 * 1024 * 1024, max: 128 * 1024 * 1024 },
  stackLimitBytes: { min: 64 * 1024, max: 8 * 1024 * 1024 },
} as const

export const DEFAULT_SANDBOX_LIMITS: SandboxLimits = {
  cpuTimeoutMs: 750,
  memoryLimitBytes: 16 * 1024 * 1024,
  stackLimitBytes: 512 * 1024,
}

function clampLimit(value: unknown, fallback: number, bounds: { min: number; max: number }): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return fallback
  return Math.min(bounds.max, Math.max(bounds.min, value))
}

export function normalizeSandboxLimits(limits: unknown = DEFAULT_SANDBOX_LIMITS): SandboxLimits {
  const input = limits && typeof limits === 'object' ? limits as Record<string, unknown> : {}
  return {
    cpuTimeoutMs: clampLimit(input.cpuTimeoutMs, DEFAULT_SANDBOX_LIMITS.cpuTimeoutMs, SANDBOX_LIMIT_POLICY.cpuTimeoutMs),
    memoryLimitBytes: clampLimit(input.memoryLimitBytes, DEFAULT_SANDBOX_LIMITS.memoryLimitBytes, SANDBOX_LIMIT_POLICY.memoryLimitBytes),
    stackLimitBytes: clampLimit(input.stackLimitBytes, DEFAULT_SANDBOX_LIMITS.stackLimitBytes, SANDBOX_LIMIT_POLICY.stackLimitBytes),
  }
}

function dumpError(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

let modulePromise: ReturnType<typeof newQuickJSWASMModuleFromVariant> | undefined

export async function runInQuickJSSandbox(code: string, limits: SandboxLimits = DEFAULT_SANDBOX_LIMITS): Promise<SandboxResult> {
  const safeLimits = normalizeSandboxLimits(limits)
  modulePromise ??= newQuickJSWASMModuleFromVariant(variant)
  const quickJS = await modulePromise
  const runtime = quickJS.newRuntime()
  runtime.setMemoryLimit(safeLimits.memoryLimitBytes)
  runtime.setMaxStackSize(safeLimits.stackLimitBytes)
  const deadline = Date.now() + safeLimits.cpuTimeoutMs
  let interrupted = false
  runtime.setInterruptHandler(() => {
    interrupted = Date.now() >= deadline
    return interrupted
  })
  const context = runtime.newContext()
  const captured: string[] = []
  const consoleOutput: string[] = []
  let captureEval: QuickJSHandle | undefined
  let captureFunction: QuickJSHandle | undefined
  let consoleHandle: QuickJSHandle | undefined
  let logHandle: QuickJSHandle | undefined

  try {
    captureEval = context.newFunction('eval', (...args) => {
      if (args[0]) captured.push(String(context.dump(args[0])))
      return context.undefined
    })
    context.setProp(context.global, 'eval', captureEval)

    captureFunction = context.newFunction('Function', (...args) => {
      if (args.length) captured.push(String(context.dump(args.at(-1)!)))
      return context.newFunction('capturedFunction', () => context.undefined)
    })
    context.setProp(context.global, 'Function', captureFunction)
    consoleHandle = context.newObject()
    logHandle = context.newFunction('log', (...args) => {
      consoleOutput.push(args.map((argument) => String(context.dump(argument))).join(' '))
    })
    context.setProp(consoleHandle, 'log', logHandle)
    context.setProp(context.global, 'console', consoleHandle)

    const hardenResult = context.evalCode("Object.defineProperty((function(){}).__proto__, 'constructor', { value: Function, writable: false, configurable: false }); Object.freeze(console)", 'sandbox-bootstrap.js')
    if (hardenResult.error) {
      const detail = dumpError(context.dump(hardenResult.error))
      hardenResult.error.dispose()
      return { captured, console: consoleOutput, error: 'runtime', detail }
    }
    hardenResult.value.dispose()

    const result = context.evalCode(code, 'untrusted.js')
    if (result.error) {
      const detail = dumpError(context.dump(result.error))
      result.error.dispose()
      if (interrupted || /interrupted/iu.test(detail)) return { captured, console: consoleOutput, error: 'timeout', detail }
      if (/out of memory|memory limit/iu.test(detail)) return { captured, console: consoleOutput, error: 'memory', detail }
      return { captured, console: consoleOutput, error: 'runtime', detail }
    }
    result.value.dispose()
    return { captured, console: consoleOutput }
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause)
    if (interrupted || /interrupted/iu.test(detail)) return { captured, console: consoleOutput, error: 'timeout', detail }
    if (/out of memory|memory limit/iu.test(detail)) return { captured, console: consoleOutput, error: 'memory', detail }
    return { captured, console: consoleOutput, error: 'runtime', detail }
  } finally {
    logHandle?.dispose()
    consoleHandle?.dispose()
    captureFunction?.dispose()
    captureEval?.dispose()
    context.dispose()
    runtime.dispose()
  }
}
