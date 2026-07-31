<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getTool } from '../registry'
import { useToolProcessing } from '../useToolProcessing'
import { filterNetLogs, netLogsToCsv, netLogsToJson, parseNetLogs, type FlowSummary, type NetLogRecord, type NetLogResult } from './netlogs'

const { t } = useI18n()
const tool = getTool('soc-tools.netlogs')
const input = ref('')
const output = ref('')
const filter = ref('')
const result = ref<NetLogResult | null>(null)
const copied = ref(false)
const inputElement = ref<HTMLTextAreaElement>()
const sortKey = ref<keyof FlowSummary>('count')
const sortAscending = ref(false)
const filtered = computed(() => filterNetLogs(result.value?.records ?? [], filter.value))
const sortedFlows = computed(() => [...(result.value?.flows ?? [])].sort((a, b) => {
  const left = a[sortKey.value] ?? ''
  const right = b[sortKey.value] ?? ''
  const order = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right))
  return sortAscending.value ? order : -order
}).slice(0, 10))

function processInput() {
  copied.value = false
  result.value = parseNetLogs(input.value)
  output.value = result.value.records.length ? 'ready' : ''
}

const { inputBytes, isOverLimit, schedule, cancelPending } = useToolProcessing({ input, output, maxInputBytes: tool.recommendedMaxInputBytes, process: processInput, delayMs: 300 })

function clear() {
  cancelPending(); input.value = ''; output.value = ''; filter.value = ''; result.value = null; copied.value = false
  void nextTick(() => inputElement.value?.focus())
}

function setSort(key: keyof FlowSummary) {
  if (sortKey.value === key) sortAscending.value = !sortAscending.value
  else { sortKey.value = key; sortAscending.value = key !== 'count' && key !== 'bytes' }
}

function summaryText(): string {
  if (!result.value) return ''
  const values = (items: Array<{ value: string; count: number }>) => items.map((item) => `${item.value} ×${item.count}`).join(', ') || '—'
  return `${t('tools.netlogs.records')}: ${filtered.value.length}\n${t('tools.netlogs.format')}: ${t(`tools.netlogs.formats.${result.value.format}`)}\n${t('tools.netlogs.skipped')}: ${result.value.skippedCount}\n${t('tools.netlogs.hosts')}: ${values(result.value.unique.hosts)}\n${t('tools.netlogs.domains')}: ${values(result.value.unique.domains)}\nJA3/JA3S: ${values(result.value.unique.ja3)}`
}

async function copyOutput() { if (result.value) { await navigator.clipboard.writeText(`${summaryText()}\n\n${netLogsToCsv(filtered.value)}`); copied.value = true } }
function exportFile(format: 'csv' | 'json') {
  const contents = format === 'csv' ? netLogsToCsv(filtered.value) : netLogsToJson(filtered.value)
  const blob = new Blob([contents], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `network-logs.${format}`; anchor.click(); URL.revokeObjectURL(url)
}
function display(record: NetLogRecord, key: keyof NetLogRecord): string { const value = record[key]; return value === undefined || typeof value === 'object' ? '—' : String(value) }
</script>

<template>
  <section class="tool-page" aria-labelledby="tool-title">
    <header class="tool-heading"><span class="category">{{ t(`categories.${tool.category}`) }}</span><h1 id="tool-title">{{ t(tool.nameKey) }}</h1><p>{{ t(tool.descriptionKey) }}</p></header>
    <div class="io-panel">
      <div class="terminal-titlebar"><span class="window-marks" aria-hidden="true"><i /><i /><i /></span><span>[ network-logs ]</span></div>
      <div class="io-strip"><span class="byte-count">{{ inputBytes }} B</span><div class="strip-actions"><button class="text-button" type="button" :disabled="!filtered.length" @click="exportFile('csv')">{{ t('tools.netlogs.exportCsv') }}</button><button class="text-button" type="button" :disabled="!filtered.length" @click="exportFile('json')">{{ t('tools.netlogs.exportJson') }}</button><button class="icon-button" type="button" :disabled="!result" :aria-label="copied ? t('common.copied') : t('common.copy')" @click="copyOutput"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" /></svg></button><button class="icon-button" type="button" :aria-label="t('common.clear')" @click="clear"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" /></svg></button></div></div>
      <p class="notice" role="note">{{ t('tools.netlogs.limitation') }}</p><p class="notice" role="note">{{ t('tools.netlogs.largeNote') }}</p><p v-if="isOverLimit" class="notice warning" role="alert">{{ t('common.inputTooLarge', { size: '5 MB' }) }}</p>
      <div class="field"><label for="netlogs-input"><span>$</span> {{ t('common.input') }}</label><div class="terminal-editor input-editor"><span class="editor-prompt" aria-hidden="true">$</span><textarea id="netlogs-input" ref="inputElement" v-model="input" :placeholder="t('tools.netlogs.placeholder')" spellcheck="false" @input="schedule" /></div></div>
      <div v-if="result" class="results" aria-live="polite">
        <label class="filter-label" for="netlogs-filter">{{ t('tools.netlogs.filter') }}<input id="netlogs-filter" v-model="filter" type="search" :placeholder="t('tools.netlogs.filterPlaceholder')" aria-describedby="netlogs-filter-help"></label><p id="netlogs-filter-help" class="filter-help">{{ t('tools.netlogs.filterHelp') }}</p>
        <section class="summary" :aria-label="t('tools.netlogs.summary')"><h2>{{ t('tools.netlogs.summary') }}</h2><pre>{{ summaryText() }}</pre></section>
        <section><h2>{{ t('tools.netlogs.topFlows') }}</h2><div class="table-scroll"><table><thead><tr><th v-for="key in (['src_ip','dest_ip','dest_port','proto','count','bytes'] as const)" :key="key" scope="col"><button type="button" @click="setSort(key)">{{ t(`tools.netlogs.columns.${key}`) }}<span v-if="sortKey === key" aria-hidden="true"> {{ sortAscending ? '↑' : '↓' }}</span></button></th></tr></thead><tbody><tr v-for="flow in sortedFlows" :key="`${flow.src_ip}-${flow.dest_ip}-${flow.dest_port}-${flow.proto}`"><td>{{ flow.src_ip || '—' }}</td><td>{{ flow.dest_ip || '—' }}</td><td>{{ flow.dest_port ?? '—' }}</td><td>{{ flow.proto || '—' }}</td><td>{{ flow.count }}</td><td>{{ flow.bytes }}</td></tr></tbody></table></div></section>
        <section><h2>{{ t('tools.netlogs.rows', { count: filtered.length }) }}</h2><div class="table-scroll records-table"><table><thead><tr><th v-for="key in (['timestampUtc','src_ip','dest_ip','src_port','dest_port','proto','event_type','service','alert_signature','domain','ja3','ja3s'] as const)" :key="key" scope="col">{{ t(`tools.netlogs.columns.${key}`) }}</th></tr></thead><tbody><tr v-for="(record, index) in filtered" :key="index"><td v-for="key in (['timestampUtc','src_ip','dest_ip','src_port','dest_port','proto','event_type','service','alert_signature','domain','ja3','ja3s'] as const)" :key="key">{{ display(record, key) }}</td></tr></tbody></table></div></section>
      </div>
    </div>
  </section>
</template>

<style scoped>
.terminal-editor textarea{min-height:260px}.results{padding:12px;border-top:1px solid var(--border-hairline);background:var(--io-well)}.filter-label{display:flex;align-items:center;gap:10px;color:var(--text-secondary);font-size:.8125rem;font-weight:650}.filter-label input{width:min(100%,38rem);padding:8px 10px;border:1px solid var(--border-hairline);border-radius:4px;background:var(--surface-raised);color:var(--text-primary);font:inherit}.filter-help{margin:6px 0 14px;color:var(--text-muted);font-size:.75rem}.results section{margin-top:14px;border:1px solid var(--border-hairline);border-radius:6px;background:var(--surface-raised)}.results h2{margin:0;padding:9px 11px;border-bottom:1px solid var(--border-hairline);font:650 .8125rem var(--font-data)}.summary pre{margin:0;padding:11px;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--text-secondary);font:.75rem/1.6 var(--font-data)}.table-scroll{overflow:auto}table{width:100%;border-collapse:collapse;text-align:left;font: .75rem var(--font-data)}th,td{padding:7px 9px;border-top:1px solid var(--border-hairline);white-space:nowrap}thead th{border-top:0;color:var(--text-muted)}th button{padding:0;border:0;background:transparent;color:inherit;font:inherit;font-weight:650;cursor:pointer}.records-table{max-height:32rem}tbody tr:focus-within,tbody tr:hover{background:var(--surface-hover)}@media(max-width:40rem){.filter-label{align-items:stretch;flex-direction:column}.filter-label input{width:100%}}
</style>
