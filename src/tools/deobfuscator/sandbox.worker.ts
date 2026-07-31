import { DEFAULT_SANDBOX_LIMITS, runInQuickJSSandbox, type SandboxLimits } from './sandbox'

export interface SandboxWorkerRequest { code: string; limits?: SandboxLimits }

self.onmessage = async (event: MessageEvent<SandboxWorkerRequest>) => {
  const result = await runInQuickJSSandbox(event.data.code, event.data.limits ?? DEFAULT_SANDBOX_LIMITS)
  self.postMessage(result)
}
