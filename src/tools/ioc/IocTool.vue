<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getTool } from '../registry'
import { useToolProcessing } from '../useToolProcessing'
import { extractIocs, iocsToCsv, iocsToJson, type IocOutputMode, type IocResult } from './ioc'

const { t } = useI18n()
const tool = getTool('soc-tools.ioc')
const input = ref('')
const output = ref('')
const mode = ref<IocOutputMode>('defang')
const result = ref<IocResult | null>(null)
const copied = ref(false)

const visibleGroups = computed(() => result.value?.groups.filter((group) => group.count > 0) ?? [])

function renderResult(next: IocResult): string {
  const sections = next.groups.filter((group) => group.count > 0).map((group) => {
    const entries = group.entries.map((entry) => `${entry.value}  ×${entry.count}  [${t('tools.ioc.lines')}: ${entry.sourceLines.join(', ')}]`)
    return `[ ${t(`tools.ioc.types.${group.type}`)}: ${group.count} ]\n${entries.join('\n')}`
  })
  sections.push(`[ ${t('tools.ioc.rejected')}: ${next.rejectedCount} ]`)
  return sections.join('\n\n')
}

function process() {
  copied.value = false
  result.value = extractIocs(input.value, { output: mode.value })
  output.value = renderResult(result.value)
}

const { inputBytes, isOverLimit, schedule } = useToolProcessing({ input, output, maxInputBytes: tool.recommendedMaxInputBytes, process })

function clear() {
  input.value = ''
  output.value = ''
  result.value = null
  copied.value = false
}

async function copyText(value: string) {
  if (!value) return
  await navigator.clipboard.writeText(value)
  copied.value = true
}

function exportFile(format: 'csv' | 'json') {
  if (!result.value) return
  const contents = format === 'csv' ? iocsToCsv(result.value) : iocsToJson(result.value)
  const blob = new Blob([contents], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `ioc-report.${format}`
  anchor.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <section class="tool-page" aria-labelledby="tool-title">
    <header class="tool-heading"><span class="category">{{ t(`categories.${tool.category}`) }}</span><h1 id="tool-title">{{ t(tool.nameKey) }}</h1><p>{{ t(tool.descriptionKey) }}</p></header>
    <div class="io-panel">
      <div class="terminal-titlebar"><span class="window-marks" aria-hidden="true"><i /><i /><i /></span><span>[ ioc-extractor ]</span></div>
      <div class="io-strip">
        <fieldset><legend>{{ t('tools.ioc.outputMode') }}</legend><label class="radio-control"><input v-model="mode" type="radio" value="defang" @change="schedule"><span>{{ t('tools.ioc.defanged') }}</span></label><label class="radio-control"><input v-model="mode" type="radio" value="refang" @change="schedule"><span>{{ t('tools.ioc.refanged') }}</span></label></fieldset>
        <span class="byte-count">{{ inputBytes }} B</span>
        <div class="strip-actions">
          <button class="text-button" type="button" :disabled="!result" @click="result && copyText(iocsToCsv(result))">CSV</button><button class="text-button" type="button" :disabled="!result" @click="result && copyText(iocsToJson(result))">JSON</button>
          <button class="icon-button" type="button" :disabled="!result" :aria-label="t('tools.ioc.downloadCsv')" @click="exportFile('csv')">↓<span class="sr-only">CSV</span></button><button class="icon-button" type="button" :disabled="!result" :aria-label="t('tools.ioc.downloadJson')" @click="exportFile('json')">↓<span class="sr-only">JSON</span></button>
          <button class="icon-button" type="button" :disabled="!output" :aria-label="copied ? t('common.copied') : t('common.copy')" @click="copyText(output)"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" /></svg></button>
          <button class="icon-button" type="button" :aria-label="t('common.clear')" @click="clear"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" /></svg></button>
        </div>
      </div>
      <p class="notice" role="note">{{ t('tools.ioc.limitation') }}</p><p v-if="isOverLimit" class="notice warning" role="alert">{{ t('common.inputTooLarge', { size: '1 MB' }) }}</p>
      <div class="editor-grid"><div class="field"><label for="ioc-input"><span>$</span> {{ t('common.input') }}</label><div class="terminal-editor input-editor"><span class="editor-prompt" aria-hidden="true">$</span><textarea id="ioc-input" v-model="input" :placeholder="t('tools.ioc.placeholder')" spellcheck="false" @input="schedule" /></div></div><div class="field"><label for="ioc-output"><span>&gt;</span> {{ t('common.output') }} <span v-if="result">({{ result.total }})</span></label><div class="terminal-editor"><span class="editor-prompt" aria-hidden="true">&gt;</span><textarea id="ioc-output" :value="output" :placeholder="t('common.result')" readonly :aria-describedby="visibleGroups.length ? 'ioc-summary' : undefined" /></div><span id="ioc-summary" class="sr-only">{{ visibleGroups.map((group) => `${t(`tools.ioc.types.${group.type}`)}: ${group.count}`).join(', ') }}</span></div></div>
    </div>
  </section>
</template>
