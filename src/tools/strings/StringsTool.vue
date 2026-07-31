<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { decodeBase64Bytes } from '../base64/base64'
import { decodeHexBytes } from '../hex/hex'
import type { IocResult } from '../ioc/ioc'
import { getTool } from '../registry'
import { useToolProcessing } from '../useToolProcessing'
import { extractStringIocs, extractStrings, stringsToCsv, stringsToJson, type ExtractedString, type ExtractStringsOptions, type StringEncoding } from './strings'

const { t } = useI18n()
const tool = getTool('soc-tools.strings')
const input = ref('')
const output = ref('')
const error = ref('')
const sourceMode = ref<'file' | 'bytes'>('file')
const byteFormat = ref<'hex' | 'base64'>('hex')
const minimumLength = ref(4)
const selectedEncodings = ref<StringEncoding[]>(['ascii', 'utf-16le', 'utf-16be'])
const deduplicate = ref(true)
const fileBytes = ref<Uint8Array | null>(null)
const fileName = ref('')
const strings = ref<ExtractedString[]>([])
const indicators = ref<IocResult | null>(null)
const copied = ref(false)
const dragging = ref(false)
let worker: Worker | undefined

const indicatorGroups = computed(() => indicators.value?.groups.filter((group) => group.count > 0) ?? [])

function options(): ExtractStringsOptions {
  return { minimumLength: minimumLength.value, encodings: selectedEncodings.value, deduplicate: deduplicate.value }
}

function bytesFromInput(): Uint8Array {
  if (sourceMode.value === 'file') return fileBytes.value ?? new Uint8Array()
  return byteFormat.value === 'hex' ? decodeHexBytes(input.value) : decodeBase64Bytes(input.value)
}

function render(nextStrings: ExtractedString[], nextIndicators: IocResult): string {
  const lines = nextStrings.map((item) => `${item.offset} (0x${item.offset.toString(16).padStart(8, '0')})  [${item.encoding.toUpperCase()}]  ${item.value}`)
  lines.push('', `[ ${t('tools.strings.indicators')}: ${nextIndicators.total} ]`)
  for (const group of nextIndicators.groups.filter((candidate) => candidate.count > 0)) {
    lines.push(`${t(`tools.ioc.types.${group.type}`)}:`, ...group.entries.map((entry) => `  ${entry.value}`))
  }
  return lines.join('\n')
}

function finish(nextStrings: ExtractedString[], nextIndicators: IocResult) {
  strings.value = nextStrings
  indicators.value = nextIndicators
  output.value = render(nextStrings, nextIndicators)
}

function cancelWorker() {
  worker?.terminate()
  worker = undefined
}

function process() {
  copied.value = false
  cancelWorker()
  let bytes: Uint8Array
  try {
    bytes = bytesFromInput()
  } catch {
    output.value = ''
    strings.value = []
    indicators.value = null
    error.value = t(`tools.strings.invalid.${byteFormat.value}`)
    return
  }
  if (bytes.byteLength > tool.recommendedMaxInputBytes) {
    output.value = ''
    error.value = t('common.inputTooLarge', { size: '10 MB' })
    return
  }
  if (bytes.byteLength < 512_000) {
    const nextStrings = extractStrings(bytes, options())
    finish(nextStrings, extractStringIocs(nextStrings))
    return
  }
  const currentWorker = new Worker(new URL('./strings.worker.ts', import.meta.url), { type: 'module' })
  worker = currentWorker
  currentWorker.onmessage = (event: MessageEvent<{ strings: ExtractedString[]; indicators: IocResult }>) => {
    if (worker !== currentWorker) return
    worker = undefined
    currentWorker.terminate()
    finish(event.data.strings, event.data.indicators)
  }
  currentWorker.onerror = () => {
    if (worker !== currentWorker) return
    worker = undefined
    currentWorker.terminate()
    error.value = t('tools.strings.workerError')
  }
  currentWorker.postMessage({ bytes, options: options() })
}

const { inputBytes, isOverLimit, schedule, cancelPending } = useToolProcessing({
  input, output, error, maxInputBytes: tool.recommendedMaxInputBytes, process, cancel: cancelWorker,
})

async function selectFile(file: File | undefined) {
  cancelPending()
  error.value = ''
  if (!file) return
  if (file.size > tool.recommendedMaxInputBytes) {
    fileBytes.value = null
    fileName.value = file.name
    output.value = ''
    error.value = t('common.inputTooLarge', { size: '10 MB' })
    return
  }
  fileBytes.value = new Uint8Array(await file.arrayBuffer())
  fileName.value = file.name
  input.value = file.name
  schedule()
}

function onDrop(event: DragEvent) {
  dragging.value = false
  void selectFile(event.dataTransfer?.files[0])
}

function clear() {
  cancelPending()
  input.value = ''
  output.value = ''
  error.value = ''
  fileBytes.value = null
  fileName.value = ''
  strings.value = []
  indicators.value = null
  copied.value = false
}

async function copyOutput() {
  if (!output.value) return
  await navigator.clipboard.writeText(output.value)
  copied.value = true
}

function exportFile(format: 'csv' | 'json') {
  if (!strings.value.length) return
  const content = format === 'csv' ? stringsToCsv(strings.value) : stringsToJson(strings.value)
  const url = URL.createObjectURL(new Blob([content], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `strings-report.${format}`
  anchor.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <section class="tool-page" aria-labelledby="tool-title">
    <header class="tool-heading"><span class="category">{{ t(`categories.${tool.category}`) }}</span><h1 id="tool-title">{{ t(tool.nameKey) }}</h1><p>{{ t(tool.descriptionKey) }}</p></header>
    <div class="io-panel">
      <div class="terminal-titlebar"><span class="window-marks" aria-hidden="true"><i /><i /><i /></span><span>[ strings ]</span></div>
      <div class="io-strip strings-controls">
        <fieldset><legend>{{ t('tools.strings.source') }}</legend><label class="radio-control"><input v-model="sourceMode" type="radio" value="file" @change="clear"><span>{{ t('tools.strings.file') }}</span></label><label class="radio-control"><input v-model="sourceMode" type="radio" value="bytes" @change="clear"><span>{{ t('tools.strings.bytes') }}</span></label></fieldset>
        <label>{{ t('tools.strings.minimum') }} <input v-model.number="minimumLength" class="number-input" type="number" min="1" max="1024" @input="schedule"></label>
        <label v-for="encoding in (['ascii', 'utf-16le', 'utf-16be'] as const)" :key="encoding" class="check-control"><input v-model="selectedEncodings" type="checkbox" :value="encoding" @change="schedule">{{ encoding.toUpperCase() }}</label>
        <label class="check-control"><input v-model="deduplicate" type="checkbox" @change="schedule">{{ t('tools.strings.deduplicate') }}</label>
        <span class="byte-count">{{ sourceMode === 'file' ? (fileBytes?.byteLength ?? 0) : inputBytes }} B</span>
        <div class="strip-actions"><button class="text-button" type="button" :disabled="!strings.length" @click="exportFile('csv')">CSV ↓</button><button class="text-button" type="button" :disabled="!strings.length" @click="exportFile('json')">JSON ↓</button><button class="icon-button" type="button" :disabled="!output" :aria-label="copied ? t('common.copied') : t('common.copy')" @click="copyOutput"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" /></svg></button><button class="icon-button" type="button" :aria-label="t('common.clear')" @click="clear"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" /></svg></button></div>
      </div>
      <p class="notice" role="note">{{ t('tools.strings.limitation') }}</p>
      <p v-if="isOverLimit || error.includes('10 MB')" class="notice warning" role="alert">{{ t('common.inputTooLarge', { size: '10 MB' }) }}</p>
      <div v-if="sourceMode === 'file'" class="file-area">
        <label class="drop-zone" :class="{ dragging }" for="strings-file" @dragenter.prevent="dragging = true" @dragover.prevent @dragleave.prevent="dragging = false" @drop.prevent="onDrop"><span>{{ fileName || t('tools.strings.drop') }}</span><small>{{ t('tools.strings.local') }}</small></label>
        <input id="strings-file" class="sr-only" type="file" @change="selectFile(($event.target as HTMLInputElement).files?.[0])">
      </div>
      <div v-else class="field byte-field">
        <fieldset><legend>{{ t('tools.strings.byteFormat') }}</legend><label class="radio-control"><input v-model="byteFormat" type="radio" value="hex" @change="schedule"><span>Hex</span></label><label class="radio-control"><input v-model="byteFormat" type="radio" value="base64" @change="schedule"><span>Base64</span></label></fieldset>
        <label for="strings-input"><span>$</span> {{ t('common.input') }}</label><div class="terminal-editor input-editor"><span class="editor-prompt" aria-hidden="true">$</span><textarea id="strings-input" v-model="input" :placeholder="t('tools.strings.placeholder')" spellcheck="false" @input="schedule" /></div>
      </div>
      <div class="field"><label for="strings-output"><span>&gt;</span> {{ t('common.output') }} ({{ strings.length }})</label><div class="terminal-editor strings-output"><span class="editor-prompt" aria-hidden="true">&gt;</span><textarea id="strings-output" :value="output" :placeholder="t('common.result')" readonly :aria-describedby="indicatorGroups.length ? 'strings-indicator-summary' : undefined" /></div><span id="strings-indicator-summary" class="sr-only">{{ indicatorGroups.map((group) => `${t(`tools.ioc.types.${group.type}`)}: ${group.count}`).join(', ') }}</span></div>
      <p v-if="error && !error.includes('10 MB')" class="notice error" role="alert">{{ error }}</p>
    </div>
  </section>
</template>

<style scoped>
.strings-controls { flex-wrap: wrap; }
.number-input { width: 5rem; margin-inline-start: .4rem; }
.file-area { padding: 1rem; }
.drop-zone { display: flex; min-height: 9rem; cursor: pointer; align-items: center; justify-content: center; flex-direction: column; gap: .5rem; border: 1px dashed currentColor; text-align: center; }
.drop-zone:hover, .drop-zone:focus-within, .drop-zone.dragging { outline: 2px solid currentColor; outline-offset: 3px; }
.drop-zone small { opacity: .75; }
.byte-field { padding: 1rem; }
.byte-field fieldset { margin-block-end: .75rem; }
.strings-output textarea { min-height: 22rem; }
</style>
