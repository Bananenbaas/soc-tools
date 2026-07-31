import { computeHashes } from './hash'

interface HashRequest {
  input: string
  mode: 'text' | 'hex'
}

self.onmessage = async (event: MessageEvent<HashRequest>) => {
  try {
    const hashes = await computeHashes(event.data.input, event.data.mode)
    self.postMessage({ hashes })
  } catch {
    self.postMessage({ error: true })
  }
}
