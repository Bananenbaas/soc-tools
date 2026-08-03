<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getTool } from '../registry'
import { useToolProcessing } from '../useToolProcessing'
import { dialects, extractIocValues, generateAll, generateSigma, generateWazuh, type ConditionOperator, type QuerySpec } from './querywizard'

interface EditableCondition { id: number, field: string, op: ConditionOperator, value: string }
type Mode = 'wizard' | 'quick'
type Scenario = 'user' | 'host' | 'ip' | 'hash' | 'blank'
type TimeKind = 'none' | 'relative' | 'absolute'

const { t } = useI18n()
const tool = getTool('soc-tools.querywizard')
const mode = ref<Mode>('wizard')
const step = ref(0)
const furthestStep = ref(0)
const scenario = ref<Scenario | ''>('')
const selectedId = ref(readDialect())
const conditions = ref<EditableCondition[]>([])
const combinator = ref<'AND' | 'OR'>('AND')
const dataSource = ref('')
const iocText = ref('')
const iocField = ref('')
const timeKind = ref<TimeKind>('none')
const relativeLast = ref('24h')
const fromISO = ref('')
const toISO = ref('')
const processingInput = ref('')
const preview = ref('')
const copied = ref(false)
const copyFailed = ref(false)
const resetOpen = ref(false)
const panelHeading = ref<HTMLElement>()
let conditionId = 0

const stepNames = ['intent', 'siem', 'conditions', 'time', 'result'] as const
const scenarioOptions: Scenario[] = ['user', 'host', 'ip', 'hash', 'blank']
const selectedDialect = computed(() => dialects.find((item) => item.id === selectedId.value)!)
const iocs = computed(() => extractIocValues(iocText.value))
const hasUnsafeIdentifiers = computed(() => Boolean(dataSource.value.trim() || conditions.value.some((item) => item.field.trim()) || iocField.value.trim()))
const rowProblems = computed(() => conditions.value.map((item) => {
  const touched = Boolean(item.field.trim() || item.value.trim())
  if (!touched) return ''
  if (!item.field.trim()) return t('tools.querywizard.validation.fieldMissing')
  if (!item.value.trim()) return t('tools.querywizard.validation.valueMissing', { field: item.field })
  if (item.op === 'in' && !splitValues(item.value).length) return t('tools.querywizard.validation.listEmpty', { field: item.field })
  return ''
}))
const conditionsValid = computed(() => rowProblems.value.every((problem) => !problem) && (!iocText.value.trim() || Boolean(iocField.value.trim() && iocs.value.length)))
const timeError = computed(() => {
  if (timeKind.value === 'relative') return /^\d+(?:\.\d+)?(?:s|m|h|d|w)$/iu.test(relativeLast.value.trim()) ? '' : t('tools.querywizard.validation.relative')
  if (timeKind.value !== 'absolute') return ''
  if (!fromISO.value || !toISO.value) return t('tools.querywizard.validation.absoluteComplete')
  if (!validISO(fromISO.value) || !validISO(toISO.value)) return t('tools.querywizard.validation.iso')
  return Date.parse(fromISO.value) <= Date.parse(toISO.value) ? '' : t('tools.querywizard.validation.order')
})
const stepValid = computed(() => [Boolean(scenario.value), Boolean(selectedId.value), conditionsValid.value, !timeError.value, true])
const currentReason = computed(() => {
  if (stepValid.value[step.value]) return ''
  if (step.value === 0) return t('tools.querywizard.validation.intent')
  if (step.value === 1) return t('tools.querywizard.validation.siem')
  if (step.value === 2) return rowProblems.value.find(Boolean) || (!iocField.value.trim() ? t('tools.querywizard.validation.iocField') : t('tools.querywizard.validation.iocList'))
  return timeError.value
})
const result = computed(() => selectedDialect.value.generate(buildSpec()))
const quickOutputs = computed(() => generateAll(buildSpec()).filter((item) => dialects.some((dialect) => dialect.id === item.id)))
const quickField = computed({
  get: () => conditions.value[0]?.field || iocField.value,
  set: (value: string) => { iocField.value = value; ensureQuickCondition().field = value },
})
const quickValue = computed({
  get: () => conditions.value[0]?.value || '',
  set: (value: string) => { ensureQuickCondition().value = value },
})

function readDialect() {
  try { const saved = localStorage.getItem('soc-tools-querywizard-dialect'); return dialects.some((item) => item.id === saved) ? saved! : dialects[0].id } catch { return dialects[0].id }
}
function splitValues(value: string) { return value.split(/\r?\n|,/u).map((item) => item.trim()).filter(Boolean) }
function ensureQuickCondition() {
  if (!conditions.value[0]) conditions.value.push({ id: ++conditionId, field: iocField.value, op: 'equals', value: '' })
  return conditions.value[0]
}
function validISO(value: string) { return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value) && !Number.isNaN(Date.parse(value)) }
function buildSpec(): QuerySpec {
  const next = conditions.value.filter((item) => item.field.trim() && item.value.trim()).map((item) => ({ field: item.field.trim(), op: item.op, value: item.op === 'in' ? splitValues(item.value) : item.value }))
  if (iocField.value.trim() && iocs.value.length) next.push({ field: iocField.value.trim(), op: 'in', value: iocs.value })
  const timeWindow = timeKind.value === 'relative' ? { kind: 'relative' as const, last: relativeLast.value.trim() } : timeKind.value === 'absolute' ? { kind: 'absolute' as const, fromISO: fromISO.value, toISO: toISO.value } : undefined
  return { dataSource: dataSource.value.trim() || undefined, conditions: next, combinator: combinator.value, timeWindow }
}
function processPreview() { preview.value = selectedDialect.value.generate(buildSpec()) }
const { inputBytes, isOverLimit, schedule, cancelPending } = useToolProcessing({ input: processingInput, output: preview, maxInputBytes: tool.recommendedMaxInputBytes, process: processPreview })
watch([conditions, combinator, dataSource, iocText, iocField, timeKind, relativeLast, fromISO, toISO, selectedId], () => {
  processingInput.value = JSON.stringify({ conditions: conditions.value, combinator: combinator.value, dataSource: dataSource.value, iocText: iocText.value, iocField: iocField.value, timeKind: timeKind.value, relativeLast: relativeLast.value, fromISO: fromISO.value, toISO: toISO.value, selectedId: selectedId.value })
  copied.value = false; copyFailed.value = false; schedule()
}, { deep: true, immediate: true })
watch(selectedId, (value) => { try { localStorage.setItem('soc-tools-querywizard-dialect', value) } catch { /* Opslag kan door browserbeleid geblokkeerd zijn. */ } })

function chooseScenario(value: Scenario) {
  scenario.value = value
  if (value === 'blank') { conditions.value = []; dataSource.value = ''; return }
  const fields: Record<Exclude<Scenario, 'blank'>, string> = { user: 'UserName', host: 'Computer', ip: 'src_ip', hash: 'file.hash.sha256' }
  const existingValue = conditions.value[0]?.value || ''
  conditions.value = [{ id: ++conditionId, field: fields[value], op: 'equals', value: existingValue }]
  if (value === 'ip') selectedId.value = 'splunk'
  if (value === 'hash') selectedId.value = 'elastic-eql'
}
function moveTile(event: KeyboardEvent, options: string[], current: string, select: (value: string) => void) {
  const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End']
  if (!keys.includes(event.key)) return
  event.preventDefault()
  const currentIndex = Math.max(0, options.indexOf(current))
  const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (currentIndex + (event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
  select(options[nextIndex])
  void nextTick(() => (event.currentTarget as HTMLElement).parentElement?.querySelector<HTMLElement>(`[data-option="${options[nextIndex]}"]`)?.focus())
}
function moveScenario(event: KeyboardEvent) {
  moveTile(event, scenarioOptions, scenario.value, (value) => chooseScenario(value as Scenario))
}
function moveDialect(event: KeyboardEvent) {
  moveTile(event, dialects.map((dialect) => dialect.id), selectedId.value, (value) => { selectedId.value = value })
}
async function go(target: number) {
  if (target > step.value && !stepValid.value[step.value]) { focusFirstInvalid(); return }
  if (target > furthestStep.value + 1) return
  step.value = target; furthestStep.value = Math.max(furthestStep.value, target)
  await nextTick(); panelHeading.value?.focus()
}
function focusFirstInvalid() {
  void nextTick(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
}
async function addCondition() {
  conditions.value.push({ id: ++conditionId, field: '', op: 'equals', value: '' })
  await nextTick(); document.querySelector<HTMLInputElement>(`#condition-field-${conditionId}`)?.focus()
}
async function removeCondition(index: number) {
  conditions.value.splice(index, 1)
  await nextTick(); const adjacent = conditions.value[Math.min(index, conditions.value.length - 1)]; (adjacent ? document.querySelector<HTMLInputElement>(`#condition-field-${adjacent.id}`) : document.querySelector<HTMLButtonElement>('#add-condition'))?.focus()
}
async function copyResult() {
  copied.value = false; copyFailed.value = false
  try { await navigator.clipboard.writeText(result.value); copied.value = true } catch { copyFailed.value = true }
}
function reset() {
  cancelPending(); scenario.value = ''; conditions.value = []; combinator.value = 'AND'; dataSource.value = ''; iocText.value = ''; iocField.value = ''; timeKind.value = 'none'; relativeLast.value = '24h'; fromISO.value = ''; toISO.value = ''; copied.value = false; copyFailed.value = false; step.value = 0; furthestStep.value = 0; resetOpen.value = false
}
</script>

<template>
  <section class="tool-page" aria-labelledby="tool-title">
    <header class="tool-heading"><span class="category">{{ t(`categories.${tool.category}`) }}</span><h1 id="tool-title">{{ t(tool.nameKey) }}</h1><p>{{ t(tool.descriptionKey) }}</p></header>
    <div class="wizard-shell">
      <div class="terminal-titlebar"><span class="window-marks" aria-hidden="true"><i /><i /><i /></span><span>[ query-wizard ]</span></div>
      <div class="io-strip"><span class="byte-count">{{ inputBytes }} B</span><div class="mode-switch" :aria-label="t('tools.querywizard.modeLabel')"><button type="button" :aria-pressed="mode === 'wizard'" @click="mode = 'wizard'">{{ t('tools.querywizard.modes.wizard') }}</button><button type="button" :aria-pressed="mode === 'quick'" @click="mode = 'quick'">{{ t('tools.querywizard.modes.quick') }}</button></div><button class="text-button" type="button" @click="resetOpen = true">{{ t('tools.querywizard.reset.open') }}</button></div>
      <p class="notice warning" role="note">{{ t('tools.querywizard.disclaimer') }}</p>
      <p v-if="isOverLimit" class="notice warning" role="alert">{{ t('common.inputTooLarge', { size: '256 KB' }) }}</p>

      <template v-if="mode === 'wizard'">
        <p class="compact-step">{{ t('tools.querywizard.stepCount', { current: step + 1, total: 5, label: t(`tools.querywizard.steps.${stepNames[step]}`) }) }}</p>
        <ol class="stepper">
          <li v-for="(name, index) in stepNames" :key="name"><button type="button" :aria-current="index === step ? 'step' : undefined" :disabled="index > furthestStep" @click="go(index)"><span>{{ index + 1 }}</span>{{ t(`tools.querywizard.steps.${name}`) }}</button></li>
        </ol>
        <div class="step-panel">
          <section v-if="step === 0" aria-labelledby="step-heading">
            <h2 id="step-heading" ref="panelHeading" tabindex="-1">{{ t('tools.querywizard.headings.intent') }}</h2><p class="hint">{{ t('tools.querywizard.hints.intent') }}</p>
            <div class="preset-grid" role="radiogroup" :aria-label="t('tools.querywizard.headings.intent')" @keydown="moveScenario"><button v-for="(preset, index) in scenarioOptions" :key="preset" type="button" class="choice-tile" role="radio" :data-option="preset" :aria-checked="scenario === preset" :tabindex="scenario ? (scenario === preset ? 0 : -1) : (index === 0 ? 0 : -1)" @click="chooseScenario(preset)"><strong>{{ t(`tools.querywizard.presets.${preset}.name`) }}</strong><span>{{ t(`tools.querywizard.presets.${preset}.help`) }}</span></button></div>
            <p v-if="scenario && scenario !== 'blank'" class="suggestion">{{ t('tools.querywizard.suggestion') }}</p>
          </section>
          <section v-else-if="step === 1" aria-labelledby="step-heading">
            <h2 id="step-heading" ref="panelHeading" tabindex="-1">{{ t('tools.querywizard.headings.siem') }}</h2><p class="hint">{{ t('tools.querywizard.hints.siem') }}</p>
            <div class="dialect-grid" role="radiogroup" :aria-label="t('tools.querywizard.headings.siem')" @keydown="moveDialect"><button v-for="dialect in dialects" :key="dialect.id" type="button" class="choice-tile" role="radio" :data-option="dialect.id" :aria-checked="selectedId === dialect.id" :tabindex="selectedId === dialect.id ? 0 : -1" @click="selectedId = dialect.id"><strong>{{ dialect.name }}</strong><span>{{ t(`tools.querywizard.dialectNotes.${dialect.id}`) }}</span></button></div>
          </section>
          <section v-else-if="step === 2" aria-labelledby="step-heading">
            <h2 id="step-heading" ref="panelHeading" tabindex="-1">{{ t('tools.querywizard.headings.conditions') }}</h2><p class="hint">{{ t('tools.querywizard.hints.conditions') }}</p>
            <div class="form-grid"><label>{{ t('tools.querywizard.dataSource') }}<input v-model="dataSource" class="data-input" type="text" :placeholder="selectedId === 'kusto' ? 'TableName' : selectedId === 'elastic-eql' ? 'any' : t('tools.querywizard.dataSourcePlaceholder')"></label><label>{{ t('tools.querywizard.combinator') }}<select v-model="combinator"><option>AND</option><option>OR</option></select></label></div>
            <div v-for="(condition, index) in conditions" :key="condition.id" class="condition-row">
              <label>{{ t('tools.querywizard.field') }}<input :id="`condition-field-${condition.id}`" v-model="condition.field" class="data-input" type="text" :aria-invalid="Boolean(rowProblems[index])" :aria-describedby="rowProblems[index] ? `row-error-${condition.id}` : undefined"></label>
              <label>{{ t('tools.querywizard.operator') }}<select v-model="condition.op"><option value="equals">{{ t('tools.querywizard.operators.equals') }}</option><option value="not_equals">{{ t('tools.querywizard.operators.not_equals') }}</option><option value="contains">{{ t('tools.querywizard.operators.contains') }}</option><option value="in">{{ t('tools.querywizard.operators.in') }}</option></select></label>
              <label>{{ t('tools.querywizard.value') }}<textarea v-if="condition.op === 'in'" v-model="condition.value" rows="2" :aria-invalid="Boolean(rowProblems[index])" :aria-describedby="rowProblems[index] ? `row-error-${condition.id}` : undefined" /><input v-else v-model="condition.value" class="data-input" type="text" :aria-invalid="Boolean(rowProblems[index])" :aria-describedby="rowProblems[index] ? `row-error-${condition.id}` : undefined"></label>
              <button class="icon-button" type="button" :aria-label="t('tools.querywizard.remove')" @click="removeCondition(index)">×</button><p v-if="rowProblems[index]" :id="`row-error-${condition.id}`" class="field-error" role="alert">{{ rowProblems[index] }}</p>
            </div>
            <button id="add-condition" class="text-button" type="button" @click="addCondition">+ {{ t('tools.querywizard.add') }}</button>
            <fieldset class="ioc-box"><legend>{{ t('tools.querywizard.iocList') }}</legend><div class="form-grid"><label>{{ t('tools.querywizard.iocField') }}<input v-model="iocField" class="data-input" type="text" placeholder="src_ip" :aria-invalid="Boolean(iocText.trim() && !iocField.trim())"></label><label>{{ t('tools.querywizard.iocList') }}<textarea v-model="iocText" rows="4" :placeholder="t('tools.querywizard.iocPlaceholder')" spellcheck="false" /></label></div><p>{{ t('tools.querywizard.iocCount', { count: iocs.length }) }}</p></fieldset>
            <p v-if="hasUnsafeIdentifiers" class="notice warning" role="note">{{ t('tools.querywizard.identifierWarning') }}</p>
          </section>
          <section v-else-if="step === 3" aria-labelledby="step-heading">
            <h2 id="step-heading" ref="panelHeading" tabindex="-1">{{ t('tools.querywizard.headings.time') }}</h2><p class="hint">{{ t('tools.querywizard.hints.time') }}</p>
            <fieldset class="time-options"><legend>{{ t('tools.querywizard.timeKind') }}</legend><label v-for="kind in (['none','relative','absolute'] as TimeKind[])" :key="kind"><input v-model="timeKind" type="radio" name="time-kind" :value="kind">{{ t(`tools.querywizard.${kind}`) }}</label></fieldset>
            <label v-if="timeKind === 'relative'" class="single-field">{{ t('tools.querywizard.last') }}<input v-model="relativeLast" class="data-input" type="text" placeholder="24h" :aria-invalid="Boolean(timeError)" aria-describedby="time-error"></label>
            <div v-if="timeKind === 'absolute'" class="form-grid"><label>{{ t('tools.querywizard.from') }}<input v-model="fromISO" class="data-input" type="text" placeholder="2026-07-30T00:00:00Z" :aria-invalid="Boolean(timeError)" aria-describedby="time-error"></label><label>{{ t('tools.querywizard.to') }}<input v-model="toISO" class="data-input" type="text" placeholder="2026-07-31T00:00:00Z" :aria-invalid="Boolean(timeError)" aria-describedby="time-error"></label></div>
            <p v-if="timeError" id="time-error" class="field-error" role="alert">{{ timeError }}</p><p v-if="timeKind !== 'none'" class="notice warning">{{ t('tools.querywizard.timeWarning') }}</p>
          </section>
          <section v-else aria-labelledby="step-heading">
            <h2 id="step-heading" ref="panelHeading" tabindex="-1">{{ t('tools.querywizard.headings.result') }}</h2><p class="hint">{{ t('tools.querywizard.hints.result') }}</p>
            <label class="result-switcher">{{ t('tools.querywizard.result.switcher') }}<select v-model="selectedId"><option v-for="dialect in dialects" :key="dialect.id" :value="dialect.id">{{ dialect.name }}</option></select></label>
            <article class="result-card"><header><h3>{{ selectedDialect.name }}</h3><button class="primary-button" type="button" :disabled="!result" @click="copyResult">{{ copied ? t('tools.querywizard.result.copied') : t('tools.querywizard.result.copy') }}</button></header><pre tabindex="0">{{ result || t('tools.querywizard.preview.empty') }}</pre><p class="sr-status" aria-live="polite">{{ copyFailed ? t('tools.querywizard.result.copyFailure') : copied ? t('tools.querywizard.result.copySuccess') : '' }}</p></article>
            <details><summary>{{ t('tools.querywizard.result.rules') }}</summary><p>{{ t('tools.querywizard.result.rulesHelp') }}</p><h3>Sigma</h3><pre tabindex="0">{{ generateSigma(buildSpec()) }}</pre><h3>Wazuh</h3><pre tabindex="0">{{ generateWazuh(buildSpec()) }}</pre></details>
            <nav class="edit-links" :aria-label="t('tools.querywizard.result.edit')"><button type="button" @click="go(2)">{{ t('tools.querywizard.result.editConditions') }}</button><button type="button" @click="go(3)">{{ t('tools.querywizard.result.editTime') }}</button><button type="button" @click="go(1)">{{ t('tools.querywizard.result.editSiem') }}</button></nav>
          </section>
          <section v-if="step === 2 || step === 3" class="preview" aria-labelledby="preview-title"><header><h3 id="preview-title">{{ t('tools.querywizard.preview.title', { dialect: selectedDialect.name }) }}</h3><span>{{ t('tools.querywizard.preview.live') }}</span></header><pre tabindex="0">{{ preview || t('tools.querywizard.preview.empty') }}</pre><p v-if="!buildSpec().conditions.length" class="hint">{{ t(`tools.querywizard.preview.emptyNotes.${selectedId}`) }}</p></section>
        </div>
        <footer class="wizard-nav"><button class="text-button" type="button" :disabled="step === 0" @click="go(step - 1)">{{ t('tools.querywizard.navigation.back') }}</button><p v-if="currentReason" id="step-reason" role="alert">{{ currentReason }}</p><button v-if="step < 4" class="primary-button" type="button" :disabled="!stepValid[step]" :aria-describedby="!stepValid[step] ? 'step-reason' : undefined" @click="go(step + 1)">{{ t('tools.querywizard.navigation.next') }}</button></footer>
      </template>

      <section v-else class="quick-panel" aria-labelledby="quick-heading">
        <h2 id="quick-heading">{{ t('tools.querywizard.quick.heading') }}</h2><p>{{ t('tools.querywizard.quick.help') }}</p>
        <div class="form-grid"><label>{{ t('tools.querywizard.field') }}<input v-model="quickField" class="data-input" type="text" placeholder="src_ip"></label><label>{{ t('tools.querywizard.iocList') }}<textarea v-model="iocText" rows="5" :placeholder="t('tools.querywizard.iocPlaceholder')" spellcheck="false" /></label></div>
        <div class="form-grid"><label>{{ t('tools.querywizard.quick.singleValue') }}<input v-model="quickValue" class="data-input" type="text"></label><label>{{ t('tools.querywizard.timeKind') }}<select v-model="timeKind"><option value="none">{{ t('tools.querywizard.none') }}</option><option value="relative">{{ t('tools.querywizard.relative') }}</option><option value="absolute">{{ t('tools.querywizard.absolute') }}</option></select></label></div>
        <div v-if="timeKind === 'relative'" class="form-grid"><label>{{ t('tools.querywizard.last') }}<input v-model="relativeLast" class="data-input" type="text" placeholder="24h"></label></div><div v-if="timeKind === 'absolute'" class="form-grid"><label>{{ t('tools.querywizard.from') }}<input v-model="fromISO" class="data-input" type="text"></label><label>{{ t('tools.querywizard.to') }}<input v-model="toISO" class="data-input" type="text"></label></div>
        <p class="hint">{{ t('tools.querywizard.quick.shared') }}</p><section class="quick-results"><article v-for="item in quickOutputs" :key="item.id"><h3>{{ item.name }}</h3><pre tabindex="0">{{ item.value || t('tools.querywizard.preview.empty') }}</pre></article></section>
      </section>

      <div v-if="resetOpen" class="reset-confirm" role="alertdialog" aria-modal="true" aria-labelledby="reset-title"><div><h2 id="reset-title">{{ t('tools.querywizard.reset.title') }}</h2><p>{{ t('tools.querywizard.reset.help') }}</p><div><button class="text-button" type="button" @click="resetOpen = false">{{ t('tools.querywizard.reset.cancel') }}</button><button class="danger-button" type="button" @click="reset">{{ t('tools.querywizard.reset.confirm') }}</button></div></div></div>
    </div>
  </section>
</template>

<style scoped>
.wizard-shell{margin-top:24px;overflow:hidden;border:1px solid var(--border-hairline);border-radius:8px;background:var(--surface-raised);color:var(--text-primary)}
.terminal-titlebar{background:var(--io-strip);color:var(--text-secondary)}
.io-strip{align-items:center;gap:12px;background:var(--surface-overlay);color:var(--text-primary)}
.mode-switch{display:flex;border:1px solid var(--border-strong);border-radius:6px;overflow:hidden}
.mode-switch button,.stepper button,.edit-links button{border:0;background:transparent;color:var(--text-primary);font:inherit;cursor:pointer}
.mode-switch button{min-height:44px;padding:8px 14px}
.mode-switch button+button{border-left:1px solid var(--border-strong)}
.mode-switch button[aria-pressed=true]{background:var(--accent-muted);color:var(--accent-strong);font-weight:650}
.notice{max-width:960px;margin:8px auto}
.stepper{display:grid;max-width:960px;margin:0 auto;padding:16px 24px;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;list-style:none;border-bottom:1px solid var(--border-hairline)}
.stepper button{display:flex;width:100%;min-height:44px;align-items:center;gap:8px;text-align:left;color:var(--text-secondary)}
.stepper button span{display:flex;width:28px;height:28px;flex:none;align-items:center;justify-content:center;border:1px solid var(--border-strong);border-radius:50%;color:var(--text-secondary)}
.stepper button[aria-current=step]{color:var(--text-primary);font-weight:650}
.stepper button[aria-current=step] span{border-color:var(--accent);background:var(--accent-muted);color:var(--accent-strong)}
.stepper button:not(:disabled):not([aria-current=step]){color:var(--accent)}
.stepper button:not(:disabled):not([aria-current=step]) span{border-color:var(--accent);color:var(--accent)}
.stepper button:disabled{cursor:not-allowed;color:var(--text-muted);opacity:.72}
.compact-step{display:none}
.step-panel,.quick-panel{width:min(100%,960px);margin:0 auto;padding:24px}
.step-panel h2,.quick-panel h2{margin:0;color:var(--text-primary);font-size:1.25rem}
.hint{margin:4px 0 16px;color:var(--text-muted)}
.preset-grid,.dialect-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.choice-tile{display:grid;min-height:116px;align-content:start;gap:6px;padding:16px;border:1px solid var(--border-strong);border-radius:6px;background:var(--surface-overlay);color:var(--text-primary);font:inherit;text-align:left;cursor:pointer}
.choice-tile span{color:var(--text-muted);font-size:.875rem;line-height:1.45}
.choice-tile:hover{border-color:var(--accent);background:color-mix(in srgb,var(--surface-overlay) 82%,var(--surface-raised))}
.choice-tile[aria-checked=true]{border-color:var(--accent);background:var(--accent-muted)}
.choice-tile[aria-checked=true] strong{color:var(--accent-strong)}
.suggestion{margin:16px 0 0;padding:12px;border:1px solid var(--border-hairline);border-radius:6px;background:var(--surface-overlay);color:var(--text-secondary)}
.form-grid{display:grid;margin:16px 0;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.form-grid label,.condition-row label,.single-field,.result-switcher{display:grid;gap:6px;color:var(--text-secondary);font-weight:600}
.condition-row{display:grid;padding:12px 0;grid-template-columns:1fr 1fr 2fr auto;align-items:end;gap:12px;border-top:1px solid var(--border-hairline)}
.condition-row .field-error{grid-column:1/-1}
.condition-row .icon-button{min-width:44px;min-height:44px}
input:not([type=radio]):not([type=checkbox]),select,textarea{box-sizing:border-box;min-width:0;min-height:44px;padding:9px 10px;border:1px solid var(--border-strong);border-radius:6px;background:var(--surface-overlay);color:var(--text-primary);font:inherit}
.data-input,textarea,pre,.byte-count{font-family:var(--font-data)}
textarea{resize:vertical}
input:not([type=radio]):not([type=checkbox]):focus-visible,select:focus-visible,textarea:focus-visible{border-color:var(--accent);outline:2px solid var(--accent);outline-offset:2px}
.ioc-box,.time-options{margin:16px 0;padding:16px;border:1px solid var(--border-hairline);border-radius:6px;background:var(--surface-base)}
.ioc-box legend,.time-options legend{padding:0 6px;color:var(--text-primary);font-weight:650}
.ioc-box .form-grid{margin:0}
.ioc-box>p{margin:8px 0 0;color:var(--text-muted);font-family:var(--font-data)}
.time-options{display:flex;flex-wrap:wrap;gap:16px}
.time-options label{display:flex;min-height:44px;align-items:center;gap:8px;color:var(--text-secondary);cursor:pointer}
.time-options input{width:18px;height:18px;accent-color:var(--accent)}
.field-error{margin:6px 0;color:var(--danger)}
.notice.warning{color:var(--warn)}
.preview,.result-card,.quick-results article,details{margin-top:16px;border:1px solid var(--border-hairline);border-radius:6px;background:var(--surface-raised)}
.preview header,.result-card header{display:flex;align-items:center;justify-content:space-between;padding:10px 12px}
.preview h3,.result-card h3,.quick-results h3{margin:0;color:var(--text-primary);font-size:1rem}
.preview header span{color:var(--text-muted);font-size:.85rem}
.preview pre,.result-card pre,.quick-results pre,details pre{margin:0;padding:16px;overflow:auto;border-top:1px solid var(--io-border);background:var(--io-well);color:var(--accent);font-family:var(--font-data);white-space:pre-wrap;word-break:break-word}
.primary-button,.danger-button,.text-button,.icon-button,.edit-links button,summary{min-height:44px}
.primary-button{padding:8px 16px;border:1px solid var(--accent);border-radius:6px;background:var(--accent);color:var(--surface-raised);font:inherit;cursor:pointer}
.primary-button:disabled{cursor:not-allowed;opacity:.55}
.danger-button{padding:8px 16px;border:1px solid var(--danger);border-radius:6px;background:transparent;color:var(--danger)}
.wizard-nav{display:flex;max-width:960px;margin:0 auto;padding:16px 24px;align-items:center;justify-content:space-between;gap:16px;border-top:1px solid var(--border-hairline)}
.wizard-nav p{margin:0;color:var(--danger)}
.result-switcher{max-width:25rem}
.sr-status{min-height:1.4em;padding:0 12px}
.edit-links{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.edit-links button{color:var(--accent);text-decoration:underline}
.quick-results{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.quick-results article{min-width:0}
.quick-results h3{padding:10px 12px}
details{padding:12px;color:var(--text-secondary)}
details pre{border:1px solid var(--io-border)}
summary{cursor:pointer;color:var(--text-primary)}
.reset-confirm{position:fixed;z-index:20;inset:0;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--surface-base) 88%,transparent)}
.reset-confirm>div{max-width:28rem;padding:20px;border:1px solid var(--border-strong);border-radius:6px;background:var(--surface-raised)}
.reset-confirm>div>div{display:flex;justify-content:flex-end;gap:12px}
button:focus-visible,pre:focus-visible,h2:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
@media(prefers-reduced-motion:no-preference){.step-panel>section{animation:step-in 170ms ease-out}@keyframes step-in{from{opacity:.65;transform:translateY(3px)}to{opacity:1;transform:none}}}
@media(max-width:1024px){.preset-grid,.dialect-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.quick-results{grid-template-columns:1fr}}
@media(max-width:768px){.stepper{padding-inline:16px;grid-template-columns:repeat(5,auto)}.stepper button{justify-content:center}.stepper button:not([aria-current=step]){font-size:0}.condition-row{grid-template-columns:1fr 1fr}.condition-row .icon-button{justify-self:start}.condition-row .field-error{grid-column:1/-1}.step-panel,.quick-panel{padding:20px 16px}}
@media(max-width:560px){.stepper{display:none}.compact-step{display:block;margin:0;padding:12px 16px;border-bottom:1px solid var(--border-hairline);color:var(--text-secondary)}.form-grid,.condition-row,.preset-grid,.dialect-grid{grid-template-columns:1fr}.condition-row .field-error{grid-column:auto}.wizard-nav{align-items:stretch;flex-direction:column;padding-inline:16px}.wizard-nav .primary-button{order:2}.choice-tile{min-height:104px}}
</style>
