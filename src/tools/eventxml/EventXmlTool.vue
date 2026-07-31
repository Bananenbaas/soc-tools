<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getTool } from '../registry'
import { useToolProcessing } from '../useToolProcessing'
import { logonTypeKeys, parseWindowsEvents, type ParsedWindowsEvent } from './eventxml'

const { t } = useI18n()
const tool = getTool('soc-tools.eventxml')
const input = ref('')
const output = ref('')
const error = ref('')
const events = ref<ParsedWindowsEvent[]>([])
const copied = ref(false)
const inputElement = ref<HTMLTextAreaElement>()

function processInput() {
  copied.value = false
  const result = parseWindowsEvents(input.value)
  if (result.error) {
    events.value = []
    output.value = ''
    error.value = t(`tools.eventxml.errors.${result.error}`)
    return
  }
  events.value = result.events
  output.value = 'ready'
}

const { inputBytes, isOverLimit, schedule, cancelPending } = useToolProcessing({
  input, output, error, maxInputBytes: tool.recommendedMaxInputBytes, process: processInput,
})

function clear() {
  cancelPending()
  input.value = ''
  output.value = ''
  error.value = ''
  events.value = []
  copied.value = false
  void nextTick(() => inputElement.value?.focus())
}

function displayRows(event: ParsedWindowsEvent) {
  return [
    ['eventId', event.eventId], ['provider', event.provider], ['computer', event.computer], ['channel', event.channel],
    ['level', event.level], ['task', event.task], ['user', event.user], ['sid', event.sid],
    ['process', event.process], ['parentProcess', event.parentProcess], ['commandLine', event.commandLine],
    ['sourceIp', event.sourceIp], ['sourcePort', event.sourcePort], ['destinationIp', event.destinationIp], ['destinationPort', event.destinationPort],
  ].filter((row): row is [string, string] => Boolean(row[1]))
}

function copyText() {
  return events.value.map((event, index) => {
    const rows = displayRows(event).map(([key, value]) => `${t(`tools.eventxml.fields.${key}`)}: ${value}`)
    if (event.timestamp) rows.push(`UTC: ${event.timestamp.utc}`, `Europe/Amsterdam: ${event.timestamp.amsterdam}`)
    if (event.logonType) {
      const key = logonTypeKeys[event.logonType]
      rows.push(`${t('tools.eventxml.fields.logonType')}: ${event.logonType}${key ? ` (${t(`tools.eventxml.logonTypes.${key}`)})` : ''}`)
    }
    rows.push('', ...event.fields.map((field) => `[${field.section}] ${field.key}: ${field.value}`))
    return `${t('tools.eventxml.event')} ${index + 1}\n${rows.join('\n')}`
  }).join('\n\n')
}

async function copyOutput() {
  if (!events.value.length) return
  await navigator.clipboard.writeText(copyText())
  copied.value = true
}
</script>

<template>
  <section class="tool-page" aria-labelledby="tool-title">
    <header class="tool-heading"><span class="category">{{ t(`categories.${tool.category}`) }}</span><h1 id="tool-title">{{ t(tool.nameKey) }}</h1><p>{{ t(tool.descriptionKey) }}</p></header>
    <div class="io-panel">
      <div class="terminal-titlebar"><span class="window-marks" aria-hidden="true"><i /><i /><i /></span><span>[ windows-event ]</span></div>
      <div class="io-strip">
        <span v-if="events.length" class="event-count" role="status">{{ t('tools.eventxml.eventCount', { count: events.length }) }}</span>
        <span class="byte-count">{{ inputBytes }} B</span>
        <div class="strip-actions">
          <button class="icon-button" type="button" :disabled="!events.length" :aria-label="copied ? t('common.copied') : t('common.copy')" @click="copyOutput"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" /></svg></button>
          <button class="icon-button" type="button" :aria-label="t('common.clear')" @click="clear"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" /></svg></button>
        </div>
      </div>
      <p class="notice" role="note">{{ t('tools.eventxml.limitation') }}</p>
      <p v-if="isOverLimit" class="notice warning" role="alert">{{ t('common.inputTooLarge', { size: '1 MB' }) }}</p>
      <div class="eventxml-grid">
        <div class="field"><label for="eventxml-input"><span>$</span> {{ t('common.input') }}</label><div class="terminal-editor input-editor"><span class="editor-prompt" aria-hidden="true">$</span><textarea id="eventxml-input" ref="inputElement" v-model="input" :class="{ invalid: error }" :aria-invalid="Boolean(error)" :aria-describedby="error ? 'eventxml-error' : undefined" :placeholder="t('tools.eventxml.placeholder')" spellcheck="false" @input="schedule" /></div></div>
        <div class="field output-field">
          <div class="output-label"><span>&gt;</span> {{ t('common.output') }}</div>
          <div class="event-results" aria-live="polite">
            <p v-if="!events.length" class="result-placeholder">{{ t('common.result') }}</p>
            <article v-for="(event, index) in events" :key="index" class="event-card" :aria-labelledby="`event-${index}-title`">
              <h2 :id="`event-${index}-title`">{{ t('tools.eventxml.event') }} {{ index + 1 }}<span v-if="event.eventId"> · {{ event.eventId }}</span></h2>
              <dl class="event-summary">
                <template v-for="([key, value]) in displayRows(event)" :key="key"><dt>{{ t(`tools.eventxml.fields.${key}`) }}</dt><dd>{{ value }}</dd></template>
                <template v-if="event.timestamp"><dt>UTC</dt><dd>{{ event.timestamp.utc }}</dd><dt>Europe/Amsterdam</dt><dd>{{ event.timestamp.amsterdam }}</dd></template>
                <template v-if="event.logonType"><dt>{{ t('tools.eventxml.fields.logonType') }}</dt><dd>{{ event.logonType }}<span v-if="logonTypeKeys[event.logonType]"> ({{ t(`tools.eventxml.logonTypes.${logonTypeKeys[event.logonType]}`) }})</span></dd></template>
              </dl>
              <h3>{{ t('tools.eventxml.allFields') }}</h3>
              <div class="table-scroll"><table><thead><tr><th scope="col">{{ t('tools.eventxml.section') }}</th><th scope="col">{{ t('tools.eventxml.key') }}</th><th scope="col">{{ t('tools.eventxml.value') }}</th></tr></thead><tbody><tr v-for="(field, fieldIndex) in event.fields" :key="`${field.key}-${fieldIndex}`"><td>{{ field.section }}</td><th scope="row">{{ field.key }}</th><td>{{ field.value }}</td></tr></tbody></table></div>
            </article>
          </div>
        </div>
      </div>
      <p v-if="error" id="eventxml-error" class="notice error" role="alert">{{ error }}</p>
    </div>
  </section>
</template>

<style scoped>
.eventxml-grid{display:grid;grid-template-columns:minmax(18rem,.8fr) minmax(0,1.2fr)}.event-count{color:var(--text-secondary);font-family:var(--font-data);font-size:.8125rem}.output-field{border-left:1px solid var(--border-hairline)}.output-label{padding:9px 12px;border-bottom:1px solid var(--border-hairline);background:var(--surface-raised);color:var(--text-muted);font-family:var(--font-data);font-size:.75rem}.output-label span{margin-right:5px;color:var(--accent)}.event-results{min-height:360px;padding:12px;background:var(--io-well)}.result-placeholder{margin:0;color:var(--text-muted);font-family:var(--font-data)}.event-card{overflow:hidden;border:1px solid var(--border-hairline);border-radius:6px;background:var(--surface-raised)}.event-card+.event-card{margin-top:12px}.event-card h2,.event-card h3{margin:0;padding:10px 12px;font-family:var(--font-data)}.event-card h2{border-bottom:1px solid var(--border-hairline);color:var(--accent-strong);font-size:1rem}.event-card h3{border-top:1px solid var(--border-hairline);font-size:.8125rem}.event-summary{display:grid;margin:0;padding:12px;grid-template-columns:minmax(8rem,auto) minmax(0,1fr);gap:6px 12px}.event-summary dt{color:var(--text-muted);font-size:.75rem;font-weight:650}.event-summary dd{min-width:0;margin:0;overflow-wrap:anywhere;font-family:var(--font-data);font-size:.8125rem}.table-scroll{overflow-x:auto}table{width:100%;border-collapse:collapse;font-family:var(--font-data);font-size:.75rem;text-align:left}th,td{padding:7px 10px;border-top:1px solid var(--border-hairline);vertical-align:top;overflow-wrap:anywhere}thead th{color:var(--text-muted)}tbody th{color:var(--text-secondary)}tbody td:last-child{white-space:pre-wrap}.terminal-editor textarea{min-height:520px}.event-results{min-height:520px}@media(max-width:47.999rem){.eventxml-grid{grid-template-columns:1fr}.output-field{border-top:1px solid var(--border-hairline);border-left:0}.terminal-editor textarea,.event-results{min-height:300px}.event-summary{grid-template-columns:1fr}.event-summary dd{margin-bottom:4px}}
</style>
