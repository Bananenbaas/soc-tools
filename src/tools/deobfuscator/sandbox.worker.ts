import { normalizeSandboxLimits, runInQuickJSSandbox, type SandboxLimits, type SandboxResult } from './sandbox'

export interface SandboxWorkerRequest { code: string; limits?: SandboxLimits }

const MAX_SANDBOX_CODE_BYTES = 1_000_000

function invalidRequest(detail: string): SandboxResult {
  return { captured: [], console: [], error: 'runtime', detail }
}

export function parseSandboxWorkerRequest(value: unknown): { code: string; limits: SandboxLimits } | SandboxResult {
  if (!value || typeof value !== 'object') return invalidRequest('Invalid sandbox request: expected an object.')
  const request = value as Record<string, unknown>
  if (typeof request.code !== 'string' || new TextEncoder().encode(request.code).byteLength > MAX_SANDBOX_CODE_BYTES) {
    return invalidRequest('Invalid sandbox request: code is missing or too large.')
  }
  if (request.limits !== undefined && (!request.limits || typeof request.limits !== 'object' || Array.isArray(request.limits))) {
    return invalidRequest('Invalid sandbox request: limits must be an object.')
  }
  const limits = request.limits as Record<string, unknown> | undefined
  for (const key of ['cpuTimeoutMs', 'memoryLimitBytes', 'stackLimitBytes']) {
    const valueForKey = limits?.[key]
    if (valueForKey !== undefined && (typeof valueForKey !== 'number' || !Number.isFinite(valueForKey) || valueForKey < 0)) {
      return invalidRequest(`Invalid sandbox request: ${key} must be a finite non-negative number.`)
    }
  }
  return { code: request.code, limits: normalizeSandboxLimits(limits) }
}

if (typeof self !== 'undefined') {
  self.onmessage = async (event: MessageEvent<SandboxWorkerRequest>) => {
    const request = parseSandboxWorkerRequest(event.data)
    if (!('code' in request)) { self.postMessage(request); return }
    const result = await runInQuickJSSandbox(request.code, request.limits)
    self.postMessage(result)
  }
}
