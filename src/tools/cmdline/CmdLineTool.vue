<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getTool } from '../registry'
import { useToolProcessing } from '../useToolProcessing'
import { analyzeCommandLine, type CmdLineAnalysis } from './cmdline'

const { t } = useI18n()
const tool = getTool('soc-tools.cmdline')
const commandLine = ref('')
const parentProcess = ref('')
const processingInput = computed(() => `${commandLine.value}\n${parentProcess.value}`)
const output = ref('')
const error = ref('')
const result = ref<CmdLineAnalysis | null>(null)
const copied = ref(false)
const inputElement = ref<HTMLTextAreaElement>()

const indicatorGroups = computed(() => result.value?.indicators.groups.filter((group) => ['url', 'domain', 'ipv4', 'ipv6', 'windows-path'].includes(group.type) && group.count) ?? [])

function process() {
  copied.value = false
  result.value = analyzeCommandLine(commandLine.value, parentProcess.value)
  output.value = result.value.executable ? 'ready' : ''
}

const { inputBytes, isOverLimit, schedule, cancelPending } = useToolProcessing({
  input: processingInput, output, error, maxInputBytes: tool.recommendedMaxInputBytes, process,
})

function clear() {
  cancelPending()
  commandLine.value = ''
  parentProcess.value = ''
  output.value = ''
  result.value = null
  copied.value = false
  void nextTick(() => inputElement.value?.focus())
}

function renderText(): string {
  if (!result.value) return ''
  const current = result.value
  const sections = [
    `[ ${t('tools.cmdline.sections.executable')} ]\n${current.executable}`,
    `[ ${t('tools.cmdline.sections.arguments')} ]\n${current.arguments.length ? current.arguments.map((argument, index) => `${index + 1}. ${argument}`).join('\n') : t('tools.cmdline.none')}`,
  ]
  if (current.flags.length) sections.push(`[ ${t('tools.cmdline.sections.flags')} ]\n${current.flags.map((flag) => `${flag.flag}${flag.value ? ` → ${flag.value}` : ''}: ${t(`tools.cmdline.flagReasons.${flag.explanation}`)}`).join('\n')}`)
  if (current.environmentVariables.length) sections.push(`[ ${t('tools.cmdline.sections.environment')} ]\n${current.environmentVariables.join('\n')}`)
  if (current.decodedScript) sections.push(`[ ${t('tools.cmdline.sections.decoded')} ]\n${current.decodedScript}`)
  if (current.decodeError) sections.push(`[ ${t('tools.cmdline.sections.decoded')} ]\n${t('tools.cmdline.decodeFailed')}`)
  if (current.lolbinHints.length) sections.push(`[ ${t('tools.cmdline.sections.lolbins')} ]\n${current.lolbinHints.map((hint) => `${hint.name}: ${t(`tools.cmdline.lolbinReasons.${hint.reason}`)}`).join('\n')}`)
  if (indicatorGroups.value.length) sections.push(`[ ${t('tools.cmdline.sections.indicators')} ]\n${indicatorGroups.value.flatMap((group) => group.entries.map((entry) => `${t(`tools.ioc.types.${group.type}`)}: ${entry.value}`)).join('\n')}`)
  if (current.encodedFragments.length) sections.push(`[ ${t('tools.cmdline.sections.encoded')} ]\n${current.encodedFragments.map((fragment) => `${fragment.value}: ${t(`tools.cmdline.encodedReasons.${fragment.reason}`)}`).join('\n')}`)
  if (current.parentChildHints.length) sections.push(`[ ${t('tools.cmdline.sections.parentChild')} ]\n${current.parentChildHints.map((hint) => `${hint.name}: ${t(`tools.cmdline.parentReasons.${hint.reason}`)}`).join('\n')}`)
  return sections.join('\n\n')
}

async function copyOutput() {
  if (!result.value) return
  await navigator.clipboard.writeText(renderText())
  copied.value = true
}
</script>

<template>
  <section class="tool-page" aria-labelledby="tool-title">
    <header class="tool-heading"><span class="category">{{ t(`categories.${tool.category}`) }}</span><h1 id="tool-title">{{ t(tool.nameKey) }}</h1><p>{{ t(tool.descriptionKey) }}</p></header>
    <div class="io-panel">
      <div class="terminal-titlebar"><span class="window-marks" aria-hidden="true"><i /><i /><i /></span><span>[ windows-cmdline ]</span></div>
      <div class="io-strip"><span class="byte-count">{{ inputBytes }} B</span><div class="strip-actions"><button class="icon-button" type="button" :disabled="!result" :aria-label="copied ? t('common.copied') : t('common.copy')" @click="copyOutput"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" /></svg></button><button class="icon-button" type="button" :aria-label="t('common.clear')" @click="clear"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" /></svg></button></div></div>
      <p class="notice warning" role="note">{{ t('tools.cmdline.limitation') }}</p>
      <p class="notice" role="note">{{ t('tools.cmdline.tokenizationNote') }}</p>
      <p v-if="isOverLimit" class="notice warning" role="alert">{{ t('common.inputTooLarge', { size: '256 KB' }) }}</p>
      <div class="cmdline-grid">
        <div class="input-column">
          <div class="field"><label for="cmdline-input"><span>$</span> {{ t('tools.cmdline.commandLine') }}</label><div class="terminal-editor input-editor"><span class="editor-prompt" aria-hidden="true">$</span><textarea id="cmdline-input" ref="inputElement" v-model="commandLine" :placeholder="t('tools.cmdline.placeholder')" spellcheck="false" @input="schedule" /></div></div>
          <div class="parent-field"><label for="cmdline-parent">{{ t('tools.cmdline.parentProcess') }}</label><input id="cmdline-parent" v-model="parentProcess" type="text" :placeholder="t('tools.cmdline.parentPlaceholder')" spellcheck="false" @input="schedule"></div>
        </div>
        <div class="field output-field">
          <div class="output-label"><span>&gt;</span> {{ t('common.output') }}</div><div class="analysis-results" aria-live="polite">
            <p v-if="!result" class="result-placeholder">{{ t('common.result') }}</p>
            <template v-else>
              <section class="result-section"><h2>{{ t('tools.cmdline.sections.executable') }}</h2><code>{{ result.executable }}</code></section>
              <section class="result-section"><h2>{{ t('tools.cmdline.sections.arguments') }} <small>({{ t('tools.cmdline.bestEffort') }})</small></h2><ol v-if="result.arguments.length"><li v-for="(argument, index) in result.arguments" :key="index"><code>{{ argument }}</code></li></ol><p v-else>{{ t('tools.cmdline.none') }}</p></section>
              <section v-if="result.flags.length" class="result-section"><h2>{{ t('tools.cmdline.sections.flags') }}</h2><dl><template v-for="(flag, index) in result.flags" :key="index"><dt><code>{{ flag.flag }}</code><span v-if="flag.value"> → <code>{{ flag.value }}</code></span></dt><dd>{{ t(`tools.cmdline.flagReasons.${flag.explanation}`) }}</dd></template></dl></section>
              <section v-if="result.environmentVariables.length" class="result-section"><h2>{{ t('tools.cmdline.sections.environment') }}</h2><ul><li v-for="variable in result.environmentVariables" :key="variable"><code>{{ variable }}</code></li></ul></section>
              <section v-if="result.decodedScript || result.decodeError" class="result-section"><h2>{{ t('tools.cmdline.sections.decoded') }}</h2><pre v-if="result.decodedScript">{{ result.decodedScript }}</pre><p v-else>{{ t('tools.cmdline.decodeFailed') }}</p></section>
              <section v-if="result.lolbinHints.length" class="result-section"><h2>{{ t('tools.cmdline.sections.lolbins') }}</h2><div v-for="hint in result.lolbinHints" :key="hint.reason" class="hint"><strong>{{ hint.name }}</strong><p>{{ t(`tools.cmdline.lolbinReasons.${hint.reason}`) }}</p><small>{{ t('tools.cmdline.hintLimit') }}</small></div></section>
              <section v-if="indicatorGroups.length || result.encodedFragments.length" class="result-section"><h2>{{ t('tools.cmdline.sections.indicators') }}</h2><template v-for="group in indicatorGroups" :key="group.type"><h3>{{ t(`tools.ioc.types.${group.type}`) }}</h3><ul><li v-for="entry in group.entries" :key="entry.value"><code>{{ entry.value }}</code></li></ul></template><template v-if="result.encodedFragments.length"><h3>{{ t('tools.cmdline.sections.encoded') }}</h3><div v-for="fragment in result.encodedFragments" :key="fragment.value" class="hint"><code>{{ fragment.value }}</code><p>{{ t(`tools.cmdline.encodedReasons.${fragment.reason}`) }}</p></div></template></section>
              <section v-if="result.parentChildHints.length" class="result-section"><h2>{{ t('tools.cmdline.sections.parentChild') }}</h2><div v-for="hint in result.parentChildHints" :key="hint.name" class="hint"><strong>{{ hint.name }}</strong><p>{{ t(`tools.cmdline.parentReasons.${hint.reason}`) }}</p><small>{{ t('tools.cmdline.hintLimit') }}</small></div></section>
            </template>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cmdline-grid{display:grid;grid-template-columns:minmax(18rem,.8fr) minmax(0,1.2fr)}.input-column{min-width:0}.output-field{border-left:1px solid var(--border-hairline)}.output-label{padding:9px 12px;border-bottom:1px solid var(--border-hairline);background:var(--surface-raised);color:var(--text-muted);font-family:var(--font-data);font-size:.75rem}.output-label span,label span{color:var(--accent)}.analysis-results{min-height:480px;padding:12px;background:var(--io-well)}.result-placeholder{margin:0;color:var(--text-muted);font-family:var(--font-data)}.terminal-editor textarea{min-height:330px}.parent-field{padding:12px;border-top:1px solid var(--border-hairline)}.parent-field label{display:block;margin-bottom:6px;color:var(--text-muted);font-size:.75rem;font-weight:650}.parent-field input{box-sizing:border-box;width:100%;padding:9px 10px;border:1px solid var(--border-hairline);border-radius:4px;background:var(--io-well);color:var(--text-primary);font-family:var(--font-data)}.parent-field input:focus-visible{outline:2px solid var(--focus);outline-offset:2px}.result-section{padding:10px 12px;border:1px solid var(--border-hairline);border-radius:5px;background:var(--surface-raised)}.result-section+.result-section{margin-top:10px}.result-section h2,.result-section h3{margin:0 0 8px;font-family:var(--font-data)}.result-section h2{color:var(--accent-strong);font-size:.9rem}.result-section h2 small{color:var(--text-muted);font-weight:400}.result-section h3{margin-top:9px;color:var(--text-muted);font-size:.75rem}.result-section p,.result-section ol,.result-section ul,.result-section dl{margin:6px 0}.result-section code,.result-section pre{overflow-wrap:anywhere;font-family:var(--font-data)}.result-section pre{overflow:auto;padding:9px;border:1px solid var(--border-hairline);white-space:pre-wrap}.result-section dl{display:grid;grid-template-columns:minmax(8rem,auto) 1fr;gap:5px 12px}.result-section dd{margin:0}.hint{padding:8px;border-left:3px solid var(--accent);background:var(--io-well)}.hint+.hint{margin-top:6px}.hint p{margin:4px 0}.hint small{color:var(--text-muted)}@media(max-width:47.999rem){.cmdline-grid{grid-template-columns:1fr}.output-field{border-top:1px solid var(--border-hairline);border-left:0}.analysis-results{min-height:300px}.result-section dl{grid-template-columns:1fr}.result-section dd{margin-bottom:5px}}
</style>
