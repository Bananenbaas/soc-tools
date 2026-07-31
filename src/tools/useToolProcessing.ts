import { computed, onBeforeUnmount, type Ref } from 'vue'

const DEFAULT_DELAY_MS = 200

function boundedUtf8Length(value: string, limit: number): number {
  if (value.length > limit) return limit + 1
  if (value.length * 3 <= limit) return new TextEncoder().encode(value).byteLength

  let bytes = 0
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4
    if (bytes > limit) return limit + 1
  }
  return bytes
}

interface ToolProcessingOptions {
  input: Ref<string>
  output: Ref<string>
  error?: Ref<string>
  maxInputBytes: number
  process: () => void | Promise<void>
  cancel?: () => void
  delayMs?: number
}

export function useToolProcessing(options: ToolProcessingOptions) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const inputBytes = computed(() => boundedUtf8Length(options.input.value, options.maxInputBytes))
  const isOverLimit = computed(() => inputBytes.value > options.maxInputBytes)

  function cancelPending() {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    options.cancel?.()
  }

  function schedule() {
    cancelPending()
    if (options.error) options.error.value = ''
    if (!options.input.value) {
      options.output.value = ''
      return
    }
    if (isOverLimit.value) {
      options.output.value = ''
      return
    }
    timer = setTimeout(() => {
      timer = undefined
      void options.process()
    }, options.delayMs ?? DEFAULT_DELAY_MS)
  }

  onBeforeUnmount(cancelPending)
  return { inputBytes, isOverLimit, schedule, cancelPending }
}
