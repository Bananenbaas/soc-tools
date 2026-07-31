<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getTool } from '../registry'
import { useToolProcessing } from '../useToolProcessing'
import { deobfuscateStatic, type DeobfuscationResult } from './deobfuscator'
import { runSandboxWorker } from './sandboxClient'
import type { SandboxResult } from './sandbox'

const { t } = useI18n()
const tool = getTool('soc-tools.deobfuscator')
const input = ref('')
const output = ref('')
const error = ref('')
const staticResult = ref<DeobfuscationResult | null>(null)
const sandboxResult = ref<SandboxResult | null>(null)
const running = ref(false)
const copied = ref(false)
let cancelRun: (() => void) | undefined

const trace = computed(() => staticResult.value?.steps.map((step, index) => `${index + 1}. ${t(`tools.deobfuscator.steps.${step}`)}`).join('\n') || t('tools.deobfuscator.noSteps'))
const sandboxOutput = computed(() => {
  const result = sandboxResult.value
  if (!result) return ''
  const sections: string[] = []
  if (result.captured.length) sections.push(`[ ${t('tools.deobfuscator.captured')} ]\n${result.captured.join('\n\n')}`)
  if (result.console.length) sections.push(`[ ${t('tools.deobfuscator.console')} ]\n${result.console.join('\n')}`)
  if (result.error) sections.push(`[ ${t('tools.deobfuscator.resourceNotice')} ]\n${t(`tools.deobfuscator.errors.${result.error}`)}`)
  return sections.join('\n\n') || t('tools.deobfuscator.nothingCaptured')
})

function process() {
  copied.value = false
  sandboxResult.value = null
  staticResult.value = deobfuscateStatic(input.value)
  output.value = staticResult.value.output
}

function cancelSandbox() {
  cancelRun?.()
  cancelRun = undefined
  running.value = false
}

const { inputBytes, isOverLimit, schedule } = useToolProcessing({ input, output, error, maxInputBytes: tool.recommendedMaxInputBytes, process, cancel: cancelSandbox })

async function runSandbox() {
  if (!input.value || isOverLimit.value || running.value) return
  cancelSandbox()
  error.value = ''
  sandboxResult.value = null
  running.value = true
  const run = runSandboxWorker(input.value)
  cancelRun = run.cancel
  try {
    sandboxResult.value = await run.promise
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'Sandbox run cancelled') return
    error.value = t('tools.deobfuscator.workerError')
  } finally {
    cancelRun = undefined
    running.value = false
  }
}

function clear() {
  cancelSandbox()
  input.value = ''
  output.value = ''
  error.value = ''
  staticResult.value = null
  sandboxResult.value = null
  copied.value = false
  document.querySelector<HTMLTextAreaElement>('#deobfuscator-input')?.focus()
}

async function copyOutput() {
  const value = sandboxResult.value ? sandboxOutput.value : output.value
  if (!value) return
  await navigator.clipboard.writeText(value)
  copied.value = true
}
</script>

<template>
  <section class="tool-page" aria-labelledby="tool-title">
    <header class="tool-heading"><span class="category">{{ t(`categories.${tool.category}`) }}</span><h1 id="tool-title">{{ t(tool.nameKey) }}</h1><p>{{ t(tool.descriptionKey) }}</p></header>
    <div class="io-panel">
      <div class="terminal-titlebar"><span class="window-marks" aria-hidden="true"><i /><i /><i /></span><span>[ deobfuscator ]</span></div>
      <div class="io-strip">
        <button id="run-sandbox" class="text-button sandbox-button" type="button" :disabled="!input || isOverLimit || running" :aria-describedby="'sandbox-warning'" @click="runSandbox">{{ running ? t('tools.deobfuscator.running') : t('tools.deobfuscator.runSandbox') }}</button>
        <span class="byte-count">{{ inputBytes }} B</span>
        <div class="strip-actions"><button class="icon-button" type="button" :disabled="!output && !sandboxResult" :aria-label="copied ? t('common.copied') : t('common.copy')" @click="copyOutput"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" /></svg></button><button class="icon-button" type="button" :aria-label="t('common.clear')" @click="clear"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" /></svg></button></div>
      </div>
      <p id="sandbox-warning" class="notice warning" role="note">{{ t('tools.deobfuscator.warning') }}</p>
      <p class="notice" role="note">{{ t('tools.deobfuscator.limitation') }}</p>
      <p v-if="isOverLimit" class="notice warning" role="alert">{{ t('common.inputTooLarge', { size: '256 KB' }) }}</p>
      <p v-if="staticResult?.requiresSandbox" class="notice warning" role="status">{{ t('tools.deobfuscator.sandboxRequired') }}</p>
      <div class="editor-grid"><div class="field"><label for="deobfuscator-input"><span>$</span> {{ t('common.input') }}</label><div class="terminal-editor input-editor"><span class="editor-prompt" aria-hidden="true">$</span><textarea id="deobfuscator-input" v-model="input" :placeholder="t('tools.deobfuscator.placeholder')" spellcheck="false" @input="schedule" /></div></div><div class="field"><label for="deobfuscator-output"><span>&gt;</span> {{ sandboxResult ? t('tools.deobfuscator.sandboxResult') : t('tools.deobfuscator.staticResult') }}</label><div class="terminal-editor"><span class="editor-prompt" aria-hidden="true">&gt;</span><textarea id="deobfuscator-output" :value="sandboxResult ? sandboxOutput : output" :placeholder="t('common.result')" readonly aria-describedby="deobfuscator-trace" /></div></div></div>
      <div id="deobfuscator-trace" class="trace-panel" aria-live="polite"><strong>{{ t('tools.deobfuscator.trace') }}</strong><pre>{{ trace }}</pre></div>
      <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    </div>
  </section>
</template>
