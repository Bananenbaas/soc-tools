<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getTool } from '../registry'
import { useToolProcessing } from '../useToolProcessing'
import { parseEmailHeader, type EmailHeaderResult } from './emailheader'

const { t } = useI18n()
const tool = getTool('soc-tools.emailheader')
const input = ref('')
const output = ref('')
const result = ref<EmailHeaderResult>()
const copied = ref('')

function duration(milliseconds?: number): string {
  if (milliseconds === undefined) return t('tools.emailheader.unknown')
  const sign = milliseconds < 0 ? '−' : ''
  const seconds = Math.abs(milliseconds) / 1000
  if (seconds < 60) return `${sign}${seconds.toFixed(seconds % 1 ? 1 : 0)} s`
  const minutes = Math.floor(seconds / 60)
  return `${sign}${minutes}m ${Math.floor(seconds % 60)}s`
}
function process() { result.value = parseEmailHeader(input.value); output.value = JSON.stringify(result.value); copied.value = '' }
const { inputBytes, isOverLimit, schedule, cancelPending } = useToolProcessing({ input, output, maxInputBytes: tool.recommendedMaxInputBytes, process })
watch(input, schedule)

const sectionText = computed<Record<string, string>>(() => {
  if (!result.value) return { key: '', hops: '', auth: '', indicators: '' }
  const key = result.value.fields.flatMap((field) => field.values.map((value) => `${field.name}: ${value}`)).join('\n')
  const hops = result.value.hops.map((hop, index) => `${index + 1}. ${hop.fromHost ?? '—'} → ${hop.byHost ?? '—'} | ${hop.protocol ?? '—'} | ${hop.timestamp?.utc ?? hop.timestampRaw ?? '—'} | ${hop.timestamp?.amsterdam ?? '—'} | ${duration(hop.delayToNextMs)}`).join('\n')
  const auth = Object.entries(result.value.authentication.summary).map(([method, statuses]) => `${method.toUpperCase()}: ${statuses.join(', ')}`).join('\n') + `\n\n${result.value.authentication.raw.join('\n')}`
  const indicators = [...result.value.notes.map((note) => `${note.kind}: ${note.domains.join(' / ')}`), ...result.value.iocs.groups.flatMap((group) => group.entries.map((entry) => `${entry.type}: ${entry.value}`))].join('\n')
  return { key, hops, auth, indicators }
})
async function copySection(section: string) { await navigator.clipboard.writeText(sectionText.value[section] ?? ''); copied.value = section }
function clear() { cancelPending(); input.value = ''; output.value = ''; result.value = undefined; copied.value = '' }
</script>

<template>
  <section class="tool-page" aria-labelledby="tool-title">
    <header class="tool-heading"><span class="category">{{ t(`categories.${tool.category}`) }}</span><h1 id="tool-title">{{ t(tool.nameKey) }}</h1><p>{{ t(tool.descriptionKey) }}</p></header>
    <div class="io-panel">
      <div class="terminal-titlebar"><span class="window-marks" aria-hidden="true"><i /><i /><i /></span><span>[ email-header ]</span></div>
      <div class="io-strip"><span class="byte-count">{{ inputBytes }} B</span><div class="strip-actions"><button class="text-button" type="button" @click="clear">{{ t('tools.emailheader.clear') }}</button></div></div>
      <p class="notice warning" role="note">{{ t('tools.emailheader.disclaimer') }}</p>
      <p v-if="isOverLimit" class="notice warning" role="alert">{{ t('common.inputTooLarge', { size: '256 KB' }) }}</p>
      <div class="field input-field"><label for="email-header-input"><span>$</span> {{ t('tools.emailheader.rawHeader') }}</label><div class="terminal-editor input-editor"><span class="editor-prompt" aria-hidden="true">$</span><textarea id="email-header-input" v-model="input" rows="12" :placeholder="t('tools.emailheader.placeholder')" spellcheck="false" :aria-describedby="isOverLimit ? 'email-header-limit' : 'email-header-help'" /></div><span id="email-header-help" class="sr-only">{{ t('tools.emailheader.inputHelp') }}</span><span v-if="isOverLimit" id="email-header-limit" class="sr-only">{{ t('common.inputTooLarge', { size: '256 KB' }) }}</span></div>

      <div v-if="result" class="results" aria-live="polite">
        <section class="output-card" aria-labelledby="key-fields-title"><header><h2 id="key-fields-title">{{ t('tools.emailheader.sections.keyFields') }}</h2><button class="text-button" type="button" :disabled="!sectionText.key" @click="copySection('key')">{{ copied === 'key' ? t('common.copied') : t('common.copy') }}</button></header><div class="scroll"><table><tbody><tr v-for="field in result.fields" :key="field.name"><th scope="row">{{ field.name }}</th><td><span v-for="(value, index) in field.values" :key="index">{{ value }}</span></td></tr></tbody></table></div></section>
        <section class="output-card" aria-labelledby="hops-title"><header><h2 id="hops-title">{{ t('tools.emailheader.sections.received') }}</h2><button class="text-button" type="button" :disabled="!sectionText.hops" @click="copySection('hops')">{{ copied === 'hops' ? t('common.copied') : t('common.copy') }}</button></header><p v-if="!result.hops.length" class="empty">{{ t('tools.emailheader.none') }}</p><ol class="hops"><li v-for="(hop, index) in result.hops" :key="index"><strong>{{ t('tools.emailheader.hop', { count: index + 1 }) }}</strong><dl><dt>{{ t('tools.emailheader.fromHost') }}</dt><dd>{{ hop.fromHost ?? '—' }}</dd><dt>{{ t('tools.emailheader.byHost') }}</dt><dd>{{ hop.byHost ?? '—' }}</dd><dt>{{ t('tools.emailheader.protocol') }}</dt><dd>{{ hop.protocol ?? '—' }}</dd><dt>UTC</dt><dd>{{ hop.timestamp?.utc ?? hop.timestampRaw ?? '—' }}</dd><dt>Europe/Amsterdam</dt><dd>{{ hop.timestamp?.amsterdam ?? '—' }}</dd><dt>{{ t('tools.emailheader.delay') }}</dt><dd>{{ index < result.hops.length - 1 ? duration(hop.delayToNextMs) : '—' }}</dd></dl></li></ol><p v-if="result.totalTransitMs !== undefined" class="total">{{ t('tools.emailheader.totalTransit') }}: {{ duration(result.totalTransitMs) }}</p><p class="notice">{{ t('tools.emailheader.delayNote') }}</p></section>
        <section class="output-card" aria-labelledby="auth-title"><header><h2 id="auth-title">{{ t('tools.emailheader.sections.authentication') }}</h2><button class="text-button" type="button" :disabled="!sectionText.auth.trim()" @click="copySection('auth')">{{ copied === 'auth' ? t('common.copied') : t('common.copy') }}</button></header><div class="auth-summary"><p v-for="method in ['spf', 'dkim', 'dmarc', 'arc']" :key="method"><strong>{{ method.toUpperCase() }}</strong> {{ result.authentication.summary[method]?.join(', ') ?? t('tools.emailheader.notReported') }}</p></div><h3>{{ t('tools.emailheader.rawAuth') }}</h3><pre tabindex="0">{{ result.authentication.raw.join('\n') || t('tools.emailheader.none') }}</pre><p class="notice">{{ t('tools.emailheader.authNote') }}</p></section>
        <section class="output-card" aria-labelledby="indicators-title"><header><h2 id="indicators-title">{{ t('tools.emailheader.sections.indicators') }}</h2><button class="text-button" type="button" :disabled="!sectionText.indicators" @click="copySection('indicators')">{{ copied === 'indicators' ? t('common.copied') : t('common.copy') }}</button></header><ul class="notes"><li v-for="(note, index) in result.notes" :key="index">{{ note.kind === 'domain-mismatch' ? t('tools.emailheader.domainMismatch', { from: note.domains[0], other: note.domains[1] }) : t('tools.emailheader.messageIdDomain', { domain: note.domains[0] }) }}</li></ul><div v-for="group in result.iocs.groups.filter((item) => item.entries.length)" :key="group.type" class="ioc-group"><h3>{{ group.type }}</h3><ul><li v-for="entry in group.entries" :key="entry.value"><code>{{ entry.value }}</code> <span v-if="entry.count > 1">×{{ entry.count }}</span></li></ul></div><p v-if="!result.notes.length && !result.iocs.total" class="empty">{{ t('tools.emailheader.none') }}</p></section>
      </div>
    </div>
  </section>
</template>

<style scoped>
.input-field{padding:1rem}.input-field textarea{min-height:14rem}.results{display:grid;gap:1rem;padding:0 1rem 1rem}.output-card{border:1px solid var(--border);min-width:0}.output-card>header{align-items:center;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;padding:.55rem .75rem}.output-card h2{font-size:1rem;margin:0}.output-card h3{font-size:.9rem;margin:1rem 1rem .25rem}.scroll{overflow:auto}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid var(--border);padding:.55rem .75rem;text-align:left;vertical-align:top}th{font-family:var(--font-mono);width:12rem}td span{display:block;overflow-wrap:anywhere}.hops{display:grid;gap:.75rem;list-style-position:inside;margin:0;padding:1rem}.hops li{border-left:2px solid var(--accent);padding-left:.75rem}.hops strong{font-family:var(--font-mono)}dl{display:grid;grid-template-columns:minmax(8rem,auto) 1fr;gap:.25rem .75rem;margin:.5rem 0}dt{color:var(--muted)}dd{margin:0;overflow-wrap:anywhere}.total,.empty,.notes,.ioc-group,.auth-summary{margin:.75rem 1rem}.auth-summary{display:flex;flex-wrap:wrap;gap:.5rem 1.25rem}.auth-summary p{margin:0}pre{background:var(--surface);border-block:1px solid var(--border);margin:0;overflow:auto;padding:1rem;white-space:pre-wrap;word-break:break-word}.ioc-group ul{margin-top:.25rem}.notice{margin:.75rem 1rem}button:focus-visible,textarea:focus-visible,pre:focus-visible{outline:2px solid var(--accent);outline-offset:2px}@media(max-width:600px){th{width:auto}dl{grid-template-columns:1fr}.auth-summary{display:grid}}
</style>
