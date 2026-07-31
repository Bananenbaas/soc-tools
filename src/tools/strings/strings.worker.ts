import { extractStringIocs, extractStrings, type ExtractStringsOptions } from './strings'

interface StringsRequest {
  bytes: Uint8Array
  options: ExtractStringsOptions
}

self.onmessage = (event: MessageEvent<StringsRequest>) => {
  const strings = extractStrings(event.data.bytes, event.data.options)
  self.postMessage({ strings, indicators: extractStringIocs(strings) })
}
