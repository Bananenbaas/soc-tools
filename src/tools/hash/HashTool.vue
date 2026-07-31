<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getTool } from '../registry'
import { useToolProcessing } from '../useToolProcessing'
import type { HashAlgorithm } from './hash'

const { t } = useI18n()
const tool = getTool('soc-tools.hash')
const input = ref('')
const output = ref('')
const error = ref('')
const mode = ref<'text' | 'hex'>('text')
const uppercase = ref(false)
const copied = ref(false)
let worker: Worker | undefined

function cancelWorker() {
  worker?.terminate()
  worker = undefined
}

function transform() {
  copied.value = false
  cancelWorker()
  const currentWorker = new Worker(new URL('./hash.worker.ts', import.meta.url), { type: 'module' })
  worker = currentWorker
  currentWorker.onmessage = (event: MessageEvent<{ hashes?: Record<HashAlgorithm, string>; error?: boolean }>) => {
    if (worker !== currentWorker) return
    worker = undefined
    currentWorker.terminate()
    if (event.data.error || !event.data.hashes) {
      output.value = ''
      error.value = t('tools.hash.invalid')
      return
    }
    output.value = Object.entries(event.data.hashes)
      .map(([name, digest]) => `${name}: ${uppercase.value ? digest.toUpperCase() : digest}`)
      .join('\n')
  }
  currentWorker.onerror = () => {
    if (worker !== currentWorker) return
    worker = undefined
    currentWorker.terminate()
    output.value = ''
    error.value = t('tools.hash.invalid')
  }
  currentWorker.postMessage({ input: input.value, mode: mode.value })
}

const { inputBytes, isOverLimit, schedule, cancelPending } = useToolProcessing({
  input, output, error, maxInputBytes: tool.recommendedMaxInputBytes, process: transform, cancel: cancelWorker,
})

function clear() {
  cancelPending()
  input.value = ''
  output.value = ''
  error.value = ''
  copied.value = false
}

async function copyOutput() {
  if (output.value) {
    await navigator.clipboard.writeText(output.value)
    copied.value = true
  }
}
</script>
<template><section class="tool-page" aria-labelledby="tool-title"><header class="tool-heading"><span class="category">{{ t(`categories.${tool.category}`) }}</span><h1 id="tool-title">{{ t(tool.nameKey) }}</h1><p>{{ t(tool.descriptionKey) }}</p></header><div class="io-panel"><div class="terminal-titlebar"><span class="window-marks" aria-hidden="true"><i /><i /><i /></span><span>[ hash ]</span></div><div class="io-strip"><fieldset><legend>{{ t('tools.hash.inputMode') }}</legend><label class="radio-control"><input v-model="mode" type="radio" value="text" @change="schedule"><span>{{ t('tools.hash.text') }}</span></label><label class="radio-control"><input v-model="mode" type="radio" value="hex" @change="schedule"><span>{{ t('tools.hash.hex') }}</span></label></fieldset><label class="check-control"><input v-model="uppercase" type="checkbox" @change="schedule">{{ t('tools.hash.uppercase') }}</label><span class="byte-count">{{ inputBytes }} B</span><div class="strip-actions"><button class="icon-button" type="button" :disabled="!output" :aria-label="copied?t('common.copied'):t('common.copy')" @click="copyOutput"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" /></svg></button><button class="icon-button" type="button" :aria-label="t('common.clear')" @click="clear"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" /></svg></button></div></div><p class="notice warning" role="note">{{ t('tools.hash.limitation') }}</p><p v-if="isOverLimit" class="notice warning" role="alert">{{ t('common.inputTooLarge',{size:'5 MB'}) }}</p><div class="editor-grid"><div class="field"><label for="hash-input"><span>$</span> {{ t('common.input') }}</label><div class="terminal-editor input-editor"><span class="editor-prompt" aria-hidden="true">$</span><textarea id="hash-input" v-model="input" :class="{invalid:error}" :aria-invalid="Boolean(error)" :aria-describedby="error?'hash-error':undefined" :placeholder="t('tools.hash.placeholder')" spellcheck="false" @input="schedule" /></div></div><div class="field"><label for="hash-output"><span>&gt;</span> {{ t('common.output') }}</label><div class="terminal-editor"><span class="editor-prompt" aria-hidden="true">&gt;</span><textarea id="hash-output" :value="output" :placeholder="t('common.result')" readonly /></div></div></div><p v-if="error" id="hash-error" class="notice error" role="alert">{{ error }}</p></div></section></template>
