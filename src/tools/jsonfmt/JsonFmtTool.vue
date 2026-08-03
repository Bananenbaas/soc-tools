<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToolProcessing } from '../useToolProcessing'
import { inspectJson, type EmbeddedDecode, type JsonIndent, type JsonMode, type JsonStats } from './jsonfmt'

const { t } = useI18n()
const input = ref('')
const output = ref('')
const mode = ref<JsonMode>('format')
const indent = ref<JsonIndent>(2)
const validation = ref('')
const validationError = ref(false)
const stats = ref<JsonStats>()
const notes = ref<EmbeddedDecode[]>([])
const copied = ref(false)

function process() {
  copied.value = false
  const result = inspectJson(input.value, mode.value, indent.value)
  output.value = result.output
  stats.value = result.stats
  notes.value = result.notes
  validationError.value = !result.valid
  if (!result.valid && result.error) validation.value = t('tools.jsonfmt.invalid', { line: result.error.line, column: result.error.column, message: result.error.message })
  else if (mode.value === 'escape') validation.value = t('tools.jsonfmt.rawString')
  else if (mode.value === 'unescape') validation.value = t('tools.jsonfmt.validString')
  else if (result.isJsonLines) validation.value = t('tools.jsonfmt.validJsonl', { count: result.recordCount })
  else validation.value = t('tools.jsonfmt.validJson')
}

const { inputBytes, isOverLimit, schedule, cancelPending } = useToolProcessing({ input, output, maxInputBytes: 1_000_000, process })
watch([input, mode, indent], schedule, { immediate: true })

function clear() {
  cancelPending(); input.value = ''; output.value = ''; validation.value = ''; stats.value = undefined; notes.value = []; copied.value = false
}
async function copy() {
  if (!output.value) return
  await navigator.clipboard.writeText(output.value)
  copied.value = true
}
</script>

<template>
  <section class="tool-page" aria-labelledby="tool-title">
    <header class="tool-heading"><span class="category">{{ t('categories.encoding') }}</span><h1 id="tool-title">{{ t('tools.jsonfmt.name') }}</h1><p>{{ t('tools.jsonfmt.description') }}</p></header>
    <div class="io-panel">
      <div class="terminal-titlebar"><span class="window-marks" aria-hidden="true"><i /><i /><i /></span><span>[ json-formatter ]</span></div>
      <div class="io-strip"><span class="byte-count">{{ inputBytes }} B</span><div class="strip-actions"><button class="text-button" type="button" @click="clear">{{ t('common.clear') }}</button></div></div>
      <p class="notice" role="note">{{ t('tools.jsonfmt.disclaimer') }}</p>
      <p v-if="isOverLimit" class="notice warning" role="alert">{{ t('common.inputTooLarge', { size: '1 MB' }) }}</p>

      <div class="controls" :aria-label="t('tools.jsonfmt.controls')">
        <label>{{ t('tools.jsonfmt.mode') }}<select v-model="mode"><option value="format">{{ t('tools.jsonfmt.modes.format') }}</option><option value="minify">{{ t('tools.jsonfmt.modes.minify') }}</option><option value="sort">{{ t('tools.jsonfmt.modes.sort') }}</option><option value="flatten">{{ t('tools.jsonfmt.modes.flatten') }}</option><option value="escape">{{ t('tools.jsonfmt.modes.escape') }}</option><option value="unescape">{{ t('tools.jsonfmt.modes.unescape') }}</option></select></label>
        <label>{{ t('tools.jsonfmt.indent') }}<select v-model="indent" :disabled="mode === 'minify' || mode === 'flatten' || mode === 'escape' || mode === 'unescape'"><option :value="2">2</option><option :value="4">4</option><option value="\t">{{ t('tools.jsonfmt.tab') }}</option></select></label>
      </div>

      <div class="io-grid">
        <label class="pane"><span>{{ t('common.input') }}</span><textarea v-model="input" rows="18" :placeholder="t('tools.jsonfmt.placeholder')" spellcheck="false" /></label>
        <section class="pane" :aria-label="t('common.output')"><header><span>{{ t('common.output') }}</span><button class="text-button" type="button" :disabled="!output" @click="copy">{{ copied ? t('common.copied') : t('common.copy') }}</button></header><pre tabindex="0">{{ output || t('common.result') }}</pre></section>
      </div>

      <p v-if="validation" class="validation" :class="{ invalid: validationError }" :role="validationError ? 'alert' : 'status'">{{ validation }}</p>
      <section v-if="stats" class="details" aria-labelledby="stats-title"><h2 id="stats-title">{{ t('tools.jsonfmt.stats.title') }}</h2><dl><div><dt>{{ t('tools.jsonfmt.stats.bytes') }}</dt><dd>{{ stats.bytes }}</dd></div><div><dt>{{ t('tools.jsonfmt.stats.depth') }}</dt><dd>{{ stats.maxDepth }}</dd></div><div><dt>{{ t('tools.jsonfmt.stats.keys') }}</dt><dd>{{ stats.totalKeys }}</dd></div><div><dt>{{ t('tools.jsonfmt.stats.objects') }}</dt><dd>{{ stats.objects }}</dd></div><div><dt>{{ t('tools.jsonfmt.stats.arrays') }}</dt><dd>{{ stats.arrays }}</dd></div><div><dt>{{ t('tools.jsonfmt.stats.scalars') }}</dt><dd>{{ stats.scalars }}</dd></div></dl></section>
      <section v-if="notes.length" class="details" aria-labelledby="notes-title"><h2 id="notes-title">{{ t('tools.jsonfmt.notes') }}</h2><p>{{ t('tools.jsonfmt.notesHelp') }}</p><ul><li v-for="(note, index) in notes" :key="`${note.path}-${index}`"><strong>{{ note.kind }} · {{ note.path }}</strong><pre tabindex="0">{{ note.preview }}</pre></li></ul></section>
    </div>
  </section>
</template>

<style scoped>
.controls{align-items:end;border-bottom:1px solid var(--border);display:flex;flex-wrap:wrap;gap:1rem;padding:1rem}.controls label,.pane{display:grid;gap:.35rem}.controls select,textarea{background:var(--surface);border:1px solid var(--border);border-radius:.2rem;color:var(--text);font:inherit;padding:.55rem}.controls select{min-width:10rem}.io-grid{display:grid;grid-template-columns:1fr 1fr}.pane{min-width:0;padding:1rem}.pane+ .pane{border-left:1px solid var(--border)}.pane header{align-items:center;display:flex;justify-content:space-between}.pane textarea,.pane pre{box-sizing:border-box;font-family:var(--font-mono);margin:0;min-height:22rem;overflow:auto;resize:vertical;width:100%}.pane pre{background:var(--surface);border:1px solid var(--border);padding:.55rem;white-space:pre-wrap;word-break:break-word}.validation{border-top:1px solid var(--border);font-family:var(--font-mono);margin:0;padding:1rem}.validation.invalid{color:var(--danger, #c65353)}.details{border-top:1px solid var(--border);padding:1rem}.details h2{font-size:1rem;margin:0 0 .75rem}.details dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(8rem,1fr));gap:.75rem;margin:0}.details dl div{border:1px solid var(--border);padding:.6rem}.details dt{font-size:.85rem}.details dd{font-family:var(--font-mono);margin:.2rem 0 0}.details ul{display:grid;gap:.75rem;list-style:none;margin:0;padding:0}.details li{border:1px solid var(--border);padding:.75rem}.details li pre{overflow:auto;white-space:pre-wrap;word-break:break-word}button:focus-visible,select:focus-visible,textarea:focus-visible,pre:focus-visible{outline:2px solid var(--accent);outline-offset:2px}@media(max-width:760px){.io-grid{grid-template-columns:1fr}.pane+ .pane{border-left:0;border-top:1px solid var(--border)}}
</style>
