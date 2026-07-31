import type { SandboxLimits, SandboxResult } from './sandbox'

export const SANDBOX_WALL_CLOCK_MS = 2_500

export function runSandboxWorker(code: string, limits?: SandboxLimits): { promise: Promise<SandboxResult>; cancel: () => void } {
  const worker = new Worker(new URL('./sandbox.worker.ts', import.meta.url), { type: 'module' })
  let settled = false
  let rejectPromise: (reason: Error) => void = () => undefined
  const promise = new Promise<SandboxResult>((resolve, reject) => {
    rejectPromise = reject
    const timer = setTimeout(() => {
      settled = true
      worker.terminate()
      resolve({ captured: [], console: [], error: 'timeout', detail: 'Worker wall-clock limit reached' })
    }, SANDBOX_WALL_CLOCK_MS)
    worker.onmessage = (event: MessageEvent<SandboxResult>) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      worker.terminate()
      resolve(event.data)
    }
    worker.onerror = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      worker.terminate()
      reject(new Error('Sandbox worker failed'))
    }
    worker.postMessage({ code, limits })
  })
  return {
    promise,
    cancel: () => {
      if (settled) return
      settled = true
      worker.terminate()
      rejectPromise(new Error('Sandbox run cancelled'))
    },
  }
}
