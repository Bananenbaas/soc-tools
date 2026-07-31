<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getTool } from '../registry'
import { useToolProcessing } from '../useToolProcessing'
import { decodePowerShellEncodedCommand, type PowerShellDecodeResult } from './psdecoder'

type View = 'raw' | 'normalized' | 'hex' | 'strings' | 'indicators'

const { t } = useI18n()
const tool = getTool('soc-tools.psdecoder')
const input = ref('')
const output = ref('')
const error = ref('')
const result = ref<PowerShellDecodeResult | null>(null)
const view = ref<View>('raw')
const copied = ref(false)

const renderedIndicators = computed(() => {
  if (!result.value) return ''
  const sections = result.value.indicators.groups
    .filter((group) => ['url', 'domain', 'ipv4', 'ipv6', 'windows-path'].includes(group.type) && group.count > 0)
    .map((group) => `[ ${t(`tools.ioc.types.${group.type}`)} ]\n${group.entries.map((entry) => entry.value).join('\n')}`)
  if (result.value.cmdlets.length) sections.push(`[ ${t('tools.psdecoder.cmdlets')} ]\n${result.value.cmdlets.join('\n')}`)
  return sections.join('\n\n') || t('tools.psdecoder.noneFound')
})

function renderView() {
  const current = result.value
  if (!current) {
    output.value = ''
    return
  }
  output.value = view.value === 'raw' ? current.decoded
    : view.value === 'normalized' ? current.normalized
      : view.value === 'hex' ? current.hexDump
        : view.value === 'strings' ? current.printableStrings.join('\n')
          : renderedIndicators.value
}

function process() {
  error.value = ''
  copied.value = false
  try {
    result.value = decodePowerShellEncodedCommand(input.value)
    renderView()
  } catch (cause) {
    result.value = null
    output.value = ''
    error.value = cause instanceof Error && cause.message.includes('UTF-16') ? t('tools.psdecoder.invalidUtf16') : t('tools.psdecoder.invalidBase64')
  }
}

const { inputBytes, isOverLimit, schedule } = useToolProcessing({ input, output, error, maxInputBytes: tool.recommendedMaxInputBytes, process })

function changeView() {
  copied.value = false
  renderView()
}

function clear() {
  input.value = ''
  output.value = ''
  error.value = ''
  result.value = null
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
      <div class="terminal-titlebar"><span class="window-marks" aria-hidden="true"><i /><i /><i /></span><span>[ powershell-decoder ]</span></div>
      <div class="io-strip">
        <fieldset><legend>{{ t('tools.psdecoder.view') }}</legend><label v-for="option in (['raw', 'normalized', 'hex', 'strings', 'indicators'] as View[])" :key="option" class="radio-control"><input v-model="view" type="radio" :value="option" @change="changeView"><span>{{ t(`tools.psdecoder.views.${option}`) }}</span></label></fieldset>
        <span class="byte-count">{{ inputBytes }} B</span>
        <div class="strip-actions"><button class="icon-button" type="button" :disabled="!output" :aria-label="copied ? t('common.copied') : t('common.copy')" @click="copyOutput"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" /></svg></button><button class="icon-button" type="button" :aria-label="t('common.clear')" @click="clear"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" /></svg></button></div>
      </div>
      <p class="notice warning" role="note">{{ t('tools.psdecoder.limitation') }}</p><p v-if="view === 'normalized'" class="notice" role="note">{{ t('tools.psdecoder.normalizedNote') }}</p><p v-if="isOverLimit" class="notice warning" role="alert">{{ t('common.inputTooLarge', { size: '256 KB' }) }}</p>
      <div class="editor-grid"><div class="field"><label for="psdecoder-input"><span>$</span> {{ t('common.input') }}</label><div class="terminal-editor input-editor"><span class="editor-prompt" aria-hidden="true">$</span><textarea id="psdecoder-input" v-model="input" :class="{ invalid: error }" :aria-invalid="Boolean(error)" :aria-describedby="error ? 'psdecoder-error' : undefined" :placeholder="t('tools.psdecoder.placeholder')" spellcheck="false" @input="schedule" /></div></div><div class="field"><label for="psdecoder-output"><span>&gt;</span> {{ t(`tools.psdecoder.views.${view}`) }}</label><div class="terminal-editor"><span class="editor-prompt" aria-hidden="true">&gt;</span><textarea id="psdecoder-output" :value="output" :placeholder="t('common.result')" readonly /></div></div></div>
      <p v-if="error" id="psdecoder-error" class="notice error" role="alert">{{ error }}</p>
    </div>
  </section>
</template>
