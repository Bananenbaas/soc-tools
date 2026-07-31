<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getTool } from '../registry'
import { useToolProcessing } from '../useToolProcessing'
import { convertFiletime, convertGuid, convertIntegrityLevel, convertLogonType, convertSid, convertUnixAuto, convertWebkitTime, decodeAccessMask, type AccessMaskFlag } from './winartifacts'

type Converter = 'sid' | 'guid' | 'filetime' | 'webkit' | 'unix' | 'accessMask' | 'logonType' | 'integrity'
interface OutputRow { label: string; value: string }

const { t } = useI18n()
const tool = getTool('soc-tools.winartifacts')
const converter = ref<Converter>('sid')
const input = ref('')
const output = ref('')
const error = ref('')
const rows = ref<OutputRow[]>([])
const flags = ref<AccessMaskFlag[]>([])
const copied = ref(false)
const inputElement = ref<HTMLTextAreaElement>()

function timeRows(result: ReturnType<typeof convertFiletime>): OutputRow[] {
  if (result.kind === 'never') return [{ label: t('tools.winartifacts.fields.meaning'), value: t('tools.winartifacts.never') }]
  return [
    { label: 'ISO 8601', value: result.timestamp.iso }, { label: 'UTC', value: result.timestamp.utc },
    { label: 'Europe/Amsterdam', value: result.timestamp.amsterdam },
  ]
}

function processInput() {
  copied.value = false
  rows.value = []
  flags.value = []
  try {
    if (converter.value === 'sid') {
      const result = convertSid(input.value)
      rows.value = [{ label: 'SID', value: result.sid }, { label: t('tools.winartifacts.fields.binaryHex'), value: result.hex }]
    } else if (converter.value === 'guid') {
      const result = convertGuid(input.value)
      rows.value = [{ label: t('tools.winartifacts.fields.canonicalGuid'), value: result.canonical }, { label: t('tools.winartifacts.fields.binaryHex'), value: result.binaryHex }]
    } else if (converter.value === 'filetime') rows.value = timeRows(convertFiletime(input.value))
    else if (converter.value === 'webkit') rows.value = timeRows(convertWebkitTime(input.value))
    else if (converter.value === 'unix') {
      const result = convertUnixAuto(input.value)
      rows.value = [{ label: t('tools.winartifacts.fields.detectedUnit'), value: t(`tools.winartifacts.units.${result.detectedUnit}`) }, ...timeRows({ kind: 'date', timestamp: result.timestamp })]
    } else if (converter.value === 'accessMask') {
      const result = decodeAccessMask(input.value)
      rows.value = [{ label: t('tools.winartifacts.fields.normalizedMask'), value: result.value }]
      if (result.unknownBits) rows.value.push({ label: t('tools.winartifacts.fields.unknownBits'), value: result.unknownBits })
      flags.value = result.flags
    } else if (converter.value === 'logonType') {
      const result = convertLogonType(input.value)
      rows.value = [{ label: t('tools.winartifacts.fields.value'), value: result.value }, { label: t('tools.winartifacts.fields.meaning'), value: result.label }]
    } else {
      const result = convertIntegrityLevel(input.value)
      rows.value = [{ label: t('tools.winartifacts.fields.rid'), value: result.value }, { label: t('tools.winartifacts.fields.level'), value: result.label }]
    }
    output.value = [...rows.value.map((row) => `${row.label}: ${row.value}`), ...flags.value.map((flag) => `${flag.bit}: ${flag.name}`)].join('\n')
  } catch {
    output.value = ''
    error.value = t('tools.winartifacts.invalid')
  }
}

const { inputBytes, isOverLimit, schedule, cancelPending } = useToolProcessing({ input, output, error, maxInputBytes: tool.recommendedMaxInputBytes, process: processInput })

function clear() {
  cancelPending(); input.value = ''; output.value = ''; error.value = ''; rows.value = []; flags.value = []; copied.value = false
  void nextTick(() => inputElement.value?.focus())
}

function changeConverter() {
  rows.value = []; flags.value = []; output.value = ''; error.value = ''
  schedule()
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
      <div class="terminal-titlebar"><span class="window-marks" aria-hidden="true"><i /><i /><i /></span><span>[ windows-artifacts ]</span></div>
      <div class="io-strip">
        <label class="select-control">{{ t('tools.winartifacts.converter') }}<select v-model="converter" @change="changeConverter"><option v-for="item in (['sid','guid','filetime','webkit','unix','accessMask','logonType','integrity'] as Converter[])" :key="item" :value="item">{{ t(`tools.winartifacts.converters.${item}`) }}</option></select></label>
        <span class="byte-count">{{ inputBytes }} B</span>
        <div class="strip-actions"><button class="icon-button" type="button" :disabled="!output" :aria-label="copied ? t('common.copied') : t('common.copy')" @click="copyOutput"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" /></svg></button><button class="icon-button" type="button" :aria-label="t('common.clear')" @click="clear"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" /></svg></button></div>
      </div>
      <p class="notice" role="note">{{ t('tools.winartifacts.limitation') }}</p>
      <p v-if="isOverLimit" class="notice warning" role="alert">{{ t('common.inputTooLarge', { size: '8 KB' }) }}</p>
      <div class="artifact-grid">
        <div class="field"><label for="winartifact-input"><span>$</span> {{ t('common.input') }}</label><div class="terminal-editor input-editor"><span class="editor-prompt" aria-hidden="true">$</span><textarea id="winartifact-input" ref="inputElement" v-model="input" :class="{ invalid: error }" :aria-invalid="Boolean(error)" :aria-describedby="error ? 'winartifact-error' : 'winartifact-help'" :placeholder="t(`tools.winartifacts.placeholders.${converter}`)" spellcheck="false" @input="schedule" /></div><p id="winartifact-help" class="field-help">{{ t(`tools.winartifacts.help.${converter}`) }}</p></div>
        <div class="field output-field"><div class="output-label"><span>&gt;</span> {{ t('common.output') }}</div><div class="artifact-results" aria-live="polite"><p v-if="!rows.length && !flags.length" class="result-placeholder">{{ t('common.result') }}</p><dl v-if="rows.length" class="artifact-summary"><template v-for="row in rows" :key="row.label"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></template></dl><div v-if="flags.length" class="flag-list"><h2>{{ t('tools.winartifacts.fields.setBits') }}</h2><ul><li v-for="flag in flags" :key="flag.bit"><code>{{ flag.bit }}</code><span>{{ flag.name }}</span></li></ul></div></div></div>
      </div>
      <p v-if="error" id="winartifact-error" class="notice error" role="alert">{{ error }}</p>
    </div>
  </section>
</template>

<style scoped>
.artifact-grid{display:grid;grid-template-columns:minmax(18rem,.8fr) minmax(0,1.2fr)}.output-field{border-left:1px solid var(--border-hairline)}.output-label{padding:9px 12px;border-bottom:1px solid var(--border-hairline);background:var(--surface-raised);color:var(--text-muted);font-family:var(--font-data);font-size:.75rem}.output-label span{margin-right:5px;color:var(--accent)}.artifact-results{min-height:360px;padding:12px;background:var(--io-well)}.result-placeholder,.field-help{margin:0;color:var(--text-muted);font-family:var(--font-data);font-size:.8125rem}.field-help{padding:8px 12px;border-top:1px solid var(--border-hairline)}.artifact-summary{display:grid;margin:0;padding:12px;border:1px solid var(--border-hairline);border-radius:6px;background:var(--surface-raised);grid-template-columns:minmax(9rem,auto) minmax(0,1fr);gap:8px 14px}.artifact-summary dt{color:var(--text-muted);font-size:.75rem;font-weight:650}.artifact-summary dd{min-width:0;margin:0;overflow-wrap:anywhere;font-family:var(--font-data);font-size:.8125rem}.flag-list{margin-top:12px;border:1px solid var(--border-hairline);border-radius:6px;background:var(--surface-raised)}.flag-list h2{margin:0;padding:10px 12px;border-bottom:1px solid var(--border-hairline);font-family:var(--font-data);font-size:.8125rem}.flag-list ul{margin:0;padding:0;list-style:none}.flag-list li{display:grid;padding:7px 12px;border-top:1px solid var(--border-hairline);grid-template-columns:7rem 1fr;gap:10px;font-size:.8125rem}.flag-list li:first-child{border-top:0}.flag-list code{color:var(--accent-strong)}.terminal-editor textarea{min-height:320px}@media(max-width:47.999rem){.artifact-grid{grid-template-columns:1fr}.output-field{border-top:1px solid var(--border-hairline);border-left:0}.artifact-summary{grid-template-columns:1fr}.artifact-summary dd{margin-bottom:4px}.flag-list li{grid-template-columns:1fr}}
</style>
