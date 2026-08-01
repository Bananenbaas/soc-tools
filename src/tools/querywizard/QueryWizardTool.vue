<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getTool } from '../registry'
import { useToolProcessing } from '../useToolProcessing'
import { extractIocValues, generateAll, type ConditionOperator, type QuerySpec } from './querywizard'

interface EditableCondition { field: string, op: ConditionOperator, value: string }
const { t } = useI18n()
const tool = getTool('soc-tools.querywizard')
const input = ref('')
const output = ref('')
const outputs = ref<Array<{ id: string, name: string, value: string }>>([])
const conditions = ref<EditableCondition[]>([{ field: '', op: 'equals', value: '' }])
const combinator = ref<'AND' | 'OR'>('AND')
const dataSource = ref('')
const iocText = ref('')
const iocField = ref('')
const timeKind = ref<'none' | 'relative' | 'absolute'>('none')
const relativeLast = ref('24h')
const fromISO = ref('')
const toISO = ref('')
const template = ref('')
const templateValue = ref('')
const copied = ref('')

function buildSpec(): QuerySpec {
  const next = conditions.value.filter((item) => item.field.trim() && item.value.trim()).map((item) => ({ field: item.field.trim(), op: item.op, value: item.op === 'in' ? item.value.split(/\r?\n|,/u).map((value) => value.trim()).filter(Boolean) : item.value }))
  const iocs = extractIocValues(iocText.value)
  if (iocField.value.trim() && iocs.length) next.push({ field: iocField.value.trim(), op: 'in', value: iocs })
  const timeWindow = timeKind.value === 'relative' ? { kind: 'relative' as const, last: relativeLast.value } : timeKind.value === 'absolute' ? { kind: 'absolute' as const, fromISO: fromISO.value, toISO: toISO.value } : undefined
  return { dataSource: dataSource.value.trim() || undefined, conditions: next, combinator: combinator.value, timeWindow }
}

function process() {
  copied.value = ''
  outputs.value = generateAll(buildSpec())
  output.value = outputs.value.map((item) => `[ ${item.name} ]\n${item.value}`).join('\n\n')
}

const { inputBytes, isOverLimit, schedule } = useToolProcessing({ input, output, maxInputBytes: tool.recommendedMaxInputBytes, process })
watch([conditions, combinator, dataSource, iocText, iocField, timeKind, relativeLast, fromISO, toISO], () => {
  input.value = JSON.stringify({ conditions: conditions.value, dataSource: dataSource.value, iocText: iocText.value, iocField: iocField.value, timeKind: timeKind.value, relativeLast: relativeLast.value, fromISO: fromISO.value, toISO: toISO.value })
  schedule()
}, { deep: true, immediate: true })

function addCondition() { conditions.value.push({ field: '', op: 'equals', value: '' }) }
function removeCondition(index: number) { conditions.value.splice(index, 1); if (!conditions.value.length) addCondition() }
function applyTemplate() {
  const fields: Record<string, string> = { user: 'UserName', host: 'Computer', ip: 'src_ip', hash: 'file.hash.sha256' }
  if (!fields[template.value] || !templateValue.value) return
  conditions.value = [{ field: fields[template.value], op: 'equals', value: templateValue.value }]
}
function clear() {
  conditions.value = [{ field: '', op: 'equals', value: '' }]; dataSource.value = ''; iocText.value = ''; iocField.value = ''; timeKind.value = 'none'; outputs.value = []; output.value = ''; copied.value = ''
}
async function copy(item: { id: string, value: string }) { await navigator.clipboard.writeText(item.value); copied.value = item.id }
</script>

<template>
  <section class="tool-page" aria-labelledby="tool-title">
    <header class="tool-heading"><span class="category">{{ t(`categories.${tool.category}`) }}</span><h1 id="tool-title">{{ t(tool.nameKey) }}</h1><p>{{ t(tool.descriptionKey) }}</p></header>
    <div class="io-panel">
      <div class="terminal-titlebar"><span class="window-marks" aria-hidden="true"><i /><i /><i /></span><span>[ query-wizard ]</span></div>
      <div class="io-strip"><span class="byte-count">{{ inputBytes }} B</span><div class="strip-actions"><button class="text-button" type="button" @click="clear">{{ t('tools.querywizard.quickClear') }}</button></div></div>
      <p class="notice warning" role="note">{{ t('tools.querywizard.limitation') }}</p>
      <p v-if="isOverLimit" class="notice warning" role="alert">{{ t('common.inputTooLarge', { size: '256 KB' }) }}</p>

      <fieldset class="wizard-section">
        <legend>{{ t('tools.querywizard.quickMode') }}</legend><p>{{ t('tools.querywizard.quickHelp') }}</p>
        <div class="form-grid"><label>{{ t('tools.querywizard.iocField') }}<input v-model="iocField" type="text" placeholder="src_ip"></label><label class="wide">{{ t('tools.querywizard.iocList') }}<textarea v-model="iocText" rows="4" :placeholder="t('tools.querywizard.iocPlaceholder')" spellcheck="false" /></label></div>
      </fieldset>

      <fieldset class="wizard-section"><legend>{{ t('tools.querywizard.template') }}</legend><div class="form-grid"><label>{{ t('tools.querywizard.template') }}<select v-model="template"><option value="">—</option><option value="user">{{ t('tools.querywizard.templates.user') }}</option><option value="host">{{ t('tools.querywizard.templates.host') }}</option><option value="ip">{{ t('tools.querywizard.templates.ip') }}</option><option value="hash">{{ t('tools.querywizard.templates.hash') }}</option></select></label><label>{{ t('tools.querywizard.value') }}<input v-model="templateValue" type="text"></label><button class="text-button align-end" type="button" @click="applyTemplate">{{ t('tools.querywizard.apply') }}</button></div></fieldset>

      <fieldset class="wizard-section">
        <legend>{{ t('tools.querywizard.builder') }}</legend>
        <div class="form-grid"><label>{{ t('tools.querywizard.dataSource') }}<input v-model="dataSource" type="text" placeholder="index / table / category"></label><label>{{ t('tools.querywizard.combinator') }}<select v-model="combinator"><option>AND</option><option>OR</option></select></label></div>
        <div v-for="(condition, index) in conditions" :key="index" class="condition-row"><label>{{ t('tools.querywizard.field') }}<input v-model="condition.field" type="text"></label><label>{{ t('tools.querywizard.operator') }}<select v-model="condition.op"><option value="equals">{{ t('tools.querywizard.operators.equals') }}</option><option value="not_equals">{{ t('tools.querywizard.operators.not_equals') }}</option><option value="contains">{{ t('tools.querywizard.operators.contains') }}</option><option value="in">{{ t('tools.querywizard.operators.in') }}</option></select></label><label>{{ t('tools.querywizard.value') }}<input v-model="condition.value" type="text" :placeholder="condition.op === 'in' ? t('tools.querywizard.listHint') : ''"></label><button class="icon-button align-end" type="button" :aria-label="t('tools.querywizard.remove')" @click="removeCondition(index)">×</button></div>
        <button class="text-button" type="button" @click="addCondition">+ {{ t('tools.querywizard.add') }}</button>
      </fieldset>

      <fieldset class="wizard-section"><legend>{{ t('tools.querywizard.timeWindow') }}</legend><div class="form-grid"><label>{{ t('tools.querywizard.timeKind') }}<select v-model="timeKind"><option value="none">{{ t('tools.querywizard.none') }}</option><option value="relative">{{ t('tools.querywizard.relative') }}</option><option value="absolute">{{ t('tools.querywizard.absolute') }}</option></select></label><label v-if="timeKind === 'relative'">{{ t('tools.querywizard.last') }}<input v-model="relativeLast" type="text" placeholder="24h"></label><template v-if="timeKind === 'absolute'"><label>{{ t('tools.querywizard.from') }}<input v-model="fromISO" type="text" placeholder="2026-07-30T00:00:00Z"></label><label>{{ t('tools.querywizard.to') }}<input v-model="toISO" type="text" placeholder="2026-07-31T00:00:00Z"></label></template></div></fieldset>

      <section class="outputs" :aria-label="t('common.output')"><article v-for="item in outputs" :key="item.id" class="output-card"><header><h2>{{ item.name }}</h2><button class="text-button" type="button" :aria-label="`${t('common.copy')}: ${item.name}`" @click="copy(item)">{{ copied === item.id ? t('common.copied') : t('common.copy') }}</button></header><pre tabindex="0">{{ item.value }}</pre><p v-if="item.id === 'elastic-eql'" class="notice">{{ t('tools.querywizard.eqlNote') }}</p><p v-if="item.id === 'wazuh'" class="notice">{{ t('tools.querywizard.wazuhNote') }}</p></article></section>
    </div>
  </section>
</template>

<style scoped>
.wizard-section{border:0;border-top:1px solid var(--border);margin:0;padding:1rem}.wizard-section legend{font-family:var(--font-mono);padding-right:.75rem}.wizard-section p{margin:.25rem 0 .75rem}.form-grid,.condition-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:.75rem;margin-bottom:.75rem}.condition-row{grid-template-columns:1fr 1fr 2fr auto}.form-grid label,.condition-row label{display:grid;gap:.3rem}.wide{grid-column:span 2}input,select,textarea{background:var(--surface);border:1px solid var(--border);border-radius:.2rem;color:var(--text);font:inherit;padding:.55rem;min-width:0}textarea{resize:vertical;font-family:var(--font-mono)}input:focus-visible,select:focus-visible,textarea:focus-visible,button:focus-visible,pre:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.align-end{align-self:end}.outputs{display:grid;gap:1rem;padding:1rem}.output-card{border:1px solid var(--border);min-width:0}.output-card header{align-items:center;display:flex;justify-content:space-between;padding:.5rem .75rem}.output-card h2{font-size:1rem;margin:0}.output-card pre{background:var(--surface);border-top:1px solid var(--border);margin:0;overflow:auto;padding:1rem;white-space:pre-wrap;word-break:break-word}@media(max-width:700px){.condition-row{grid-template-columns:1fr}.wide{grid-column:auto}}
</style>
