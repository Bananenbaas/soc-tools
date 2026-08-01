<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getTool } from '../registry'
import { useToolProcessing } from '../useToolProcessing'
import { analyzeEntropy, decodeEntropyInput, type ByteFrequency, type EntropyAnalysis, type EntropyInputMode } from './entropy'

const { t } = useI18n()
const tool = getTool('soc-tools.entropy')
const input = ref('')
const output = ref('')
const error = ref('')
const mode = ref<EntropyInputMode>('text')
const windowSize = ref(256)
const analysis = ref<EntropyAnalysis | null>(null)
const copied = ref(false)

function byteLabel(item: ByteFrequency): string {
  return `0x${item.byte.toString(16).padStart(2, '0').toUpperCase()} (${item.count})`
}

function byteList(items: ByteFrequency[]): string {
  return items.map(byteLabel).join(', ') || '—'
}

function bar(entropy: number, width = 24): string {
  const filled = Math.round((entropy / 8) * width)
  return `${'█'.repeat(filled)}${'░'.repeat(width - filled)}`
}

function render(result: EntropyAnalysis): string {
  const stats = result.stats
  return [
    `${t('tools.entropy.overall')}: ${result.entropy.toFixed(4)} ${t('tools.entropy.bitsPerByte')}`,
    `${t('tools.entropy.normalized')}: ${result.normalizedEntropy.toFixed(4)}`,
    bar(result.entropy),
    '',
    `${t('tools.entropy.length')}: ${stats.length}`,
    `${t('tools.entropy.printable')}: ${stats.printableAsciiCount}`,
    `${t('tools.entropy.nonPrintable')}: ${stats.nonPrintableCount}`,
    `${t('tools.entropy.unique')}: ${stats.uniqueByteCount}`,
    `${t('tools.entropy.nullBytes')}: ${stats.nullByteCount}`,
    `${t('tools.entropy.mostCommon')}: ${byteList(stats.mostCommonBytes)}`,
    `${t('tools.entropy.leastCommon')}: ${byteList(stats.leastCommonBytes)}`,
    '',
    ...result.chunks.map((chunk) => `${chunk.offset.toString().padStart(8)}  ${chunk.entropy.toFixed(4)}  ${bar(chunk.entropy, 16)}`),
  ].join('\n')
}

function process() {
  copied.value = false
  if (!Number.isInteger(windowSize.value) || windowSize.value < 1 || windowSize.value > 65_536) {
    analysis.value = null
    output.value = ''
    error.value = t('tools.entropy.invalidWindow')
    return
  }
  try {
    const bytes = decodeEntropyInput(input.value, mode.value)
    if (bytes.byteLength > tool.recommendedMaxInputBytes) {
      analysis.value = null
      output.value = ''
      error.value = t('common.inputTooLarge', { size: '1 MB' })
      return
    }
    const result = analyzeEntropy(bytes, windowSize.value)
    analysis.value = result
    output.value = render(result)
  } catch {
    analysis.value = null
    output.value = ''
    error.value = t(`tools.entropy.invalid.${mode.value}`)
  }
}

const { inputBytes, isOverLimit, schedule, cancelPending } = useToolProcessing({ input, output, error, maxInputBytes: tool.recommendedMaxInputBytes, process })
function scheduleAnalysis() {
  if (!input.value) analysis.value = null
  schedule()
}
watch([mode, windowSize], scheduleAnalysis)

function clear() {
  cancelPending()
  input.value = ''
  output.value = ''
  error.value = ''
  analysis.value = null
  copied.value = false
}

async function copyOutput() {
  if (!output.value) return
  await navigator.clipboard.writeText(output.value)
  copied.value = true
}
</script>

<template>
  <section class="tool-page" aria-labelledby="tool-title">
    <header class="tool-heading"><span class="category">{{ t(`categories.${tool.category}`) }}</span><h1 id="tool-title">{{ t(tool.nameKey) }}</h1><p>{{ t(tool.descriptionKey) }}</p></header>
    <div class="io-panel">
      <div class="terminal-titlebar"><span class="window-marks" aria-hidden="true"><i /><i /><i /></span><span>[ entropy ]</span></div>
      <div class="io-strip controls">
        <fieldset><legend>{{ t('tools.entropy.inputMode') }}</legend><label v-for="item in (['text', 'hex', 'base64'] as const)" :key="item" class="radio-control"><input v-model="mode" type="radio" :value="item"><span>{{ t(`tools.entropy.modes.${item}`) }}</span></label></fieldset>
        <label for="entropy-window">{{ t('tools.entropy.windowSize') }} <input id="entropy-window" v-model.number="windowSize" class="number-input" type="number" min="1" max="65536" step="1"></label>
        <span class="byte-count">{{ inputBytes }} B</span>
        <div class="strip-actions"><button class="icon-button" type="button" :disabled="!output" :aria-label="copied ? t('common.copied') : t('common.copy')" @click="copyOutput"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" /></svg></button><button class="icon-button" type="button" :aria-label="t('common.clear')" @click="clear"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" /></svg></button></div>
      </div>
      <p class="notice" role="note">{{ t('tools.entropy.disclaimer') }}</p>
      <p class="notice" role="note">{{ t('tools.entropy.legend') }}</p>
      <p v-if="isOverLimit" class="notice warning" role="alert">{{ t('common.inputTooLarge', { size: '1 MB' }) }}</p>
      <p v-else-if="error" class="notice error" role="alert">{{ error }}</p>
      <div class="field"><label for="entropy-input"><span>$</span> {{ t('common.input') }}</label><div class="terminal-editor input-editor"><span class="editor-prompt" aria-hidden="true">$</span><textarea id="entropy-input" v-model="input" :placeholder="t('tools.entropy.placeholder')" spellcheck="false" @input="scheduleAnalysis" /></div></div>
      <section v-if="analysis" class="results" aria-live="polite" :aria-label="t('tools.entropy.results')">
        <div class="metric"><strong>{{ t('tools.entropy.overall') }}</strong><output>{{ analysis.entropy.toFixed(4) }} {{ t('tools.entropy.bitsPerByte') }}</output><code :aria-label="t('tools.entropy.entropyBar')">{{ bar(analysis.entropy) }}</code></div>
        <div class="metric"><strong>{{ t('tools.entropy.normalized') }}</strong><output>{{ analysis.normalizedEntropy.toFixed(4) }}</output></div>
        <table><caption>{{ t('tools.entropy.byteStats') }}</caption><tbody><tr><th scope="row">{{ t('tools.entropy.length') }}</th><td>{{ analysis.stats.length }}</td></tr><tr><th scope="row">{{ t('tools.entropy.printable') }}</th><td>{{ analysis.stats.printableAsciiCount }}</td></tr><tr><th scope="row">{{ t('tools.entropy.nonPrintable') }}</th><td>{{ analysis.stats.nonPrintableCount }}</td></tr><tr><th scope="row">{{ t('tools.entropy.unique') }}</th><td>{{ analysis.stats.uniqueByteCount }}</td></tr><tr><th scope="row">{{ t('tools.entropy.nullBytes') }}</th><td>{{ analysis.stats.nullByteCount }}</td></tr><tr><th scope="row">{{ t('tools.entropy.mostCommon') }}</th><td>{{ byteList(analysis.stats.mostCommonBytes) }}</td></tr><tr><th scope="row">{{ t('tools.entropy.leastCommon') }}</th><td>{{ byteList(analysis.stats.leastCommonBytes) }}</td></tr></tbody></table>
        <div class="chunks"><h2>{{ t('tools.entropy.chunks') }}</h2><p v-for="chunk in analysis.chunks" :key="chunk.offset"><span>{{ chunk.offset }}</span><span>{{ chunk.entropy.toFixed(4) }}</span><code aria-hidden="true">{{ bar(chunk.entropy, 16) }}</code></p></div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.controls{flex-wrap:wrap}.number-input{background:var(--surface);border:1px solid var(--border);color:var(--text);font:inherit;margin-inline-start:.4rem;padding:.35rem;width:6rem}.number-input:focus-visible,button:focus-visible,textarea:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.results{display:grid;gap:1rem;padding:1rem}.metric{display:grid;gap:.35rem}.metric output,.metric code,.chunks{font-family:var(--font-mono)}.metric code{overflow-wrap:anywhere}table{border-collapse:collapse;width:100%}caption,h2{font-size:1rem;font-weight:700;text-align:left;margin:0;padding:.5rem 0}th,td{border:1px solid var(--border);padding:.5rem;text-align:left;vertical-align:top}th{width:35%}.chunks{border:1px solid var(--border);padding:.75rem}.chunks p{display:grid;grid-template-columns:6rem 5rem 1fr;gap:.75rem;margin:.25rem 0;overflow-wrap:anywhere}@media(max-width:600px){.chunks p{grid-template-columns:4rem 1fr}.chunks code{grid-column:1/-1}}
</style>
