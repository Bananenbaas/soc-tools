<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getTool } from '../registry'
import { useToolProcessing } from '../useToolProcessing'
import { inspectUnicode, type UnicodeInspection } from './unicodeinspect'

const { t } = useI18n()
const tool = getTool('soc-tools.unicodeinspect')
const input = ref('')
const output = ref('')
const result = ref<UnicodeInspection>()
const copied = ref('')

function process() {
  result.value = inspectUnicode(input.value)
  output.value = JSON.stringify(result.value, null, 2)
  copied.value = ''
}
const { inputBytes, isOverLimit, schedule, cancelPending } = useToolProcessing({ input, output, maxInputBytes: tool.recommendedMaxInputBytes, process })
watch(input, schedule)

const sections = computed<Record<string, string>>(() => {
  if (!result.value) return { characters: '', observations: '', invisibles: '', normalization: '', decodes: '' }
  const current = result.value
  return {
    characters: current.characters.map((item) => `${item.position}\t${item.character}\t${item.codePoint}\t${item.category}\t${item.script}\t${item.ascii}`).join('\n'),
    observations: [
      `${t('tools.unicodeinspect.scriptsPresent')}: ${current.scripts.join(', ') || t('tools.unicodeinspect.none')}`,
      current.mixedScript ? t('tools.unicodeinspect.mixedNote', { scripts: current.scripts.filter((item) => !['Common', 'Inherited', 'Unknown'].includes(item)).join(', ') }) : t('tools.unicodeinspect.singleNote'),
      ...current.confusables.map((item) => t('tools.unicodeinspect.confusableNote', { ...item })),
    ].join('\n'),
    invisibles: current.invisibles.map((item) => `${item.position}\t${item.codePoint}\t${item.kind}\t${item.name}`).join('\n'),
    normalization: `NFC (${current.normalization.nfcChanged ? t('tools.unicodeinspect.changed') : t('tools.unicodeinspect.unchanged')}): ${current.normalization.nfc}\nNFKC (${current.normalization.nfkcChanged ? t('tools.unicodeinspect.changed') : t('tools.unicodeinspect.unchanged')}): ${current.normalization.nfkc}`,
    decodes: current.decodes.map((item) => `${t(`tools.unicodeinspect.decodeKinds.${item.kind}`)} (${item.changed ? t('tools.unicodeinspect.changed') : t('tools.unicodeinspect.unchanged')}):\n${item.value}${item.error ? `\n${t('tools.unicodeinspect.decodeError')}: ${item.error}` : ''}`).join('\n\n'),
  }
})

async function copySection(id: string) {
  const value = sections.value[id]
  if (!value) return
  await navigator.clipboard.writeText(value)
  copied.value = id
}
function clear() { cancelPending(); input.value = ''; output.value = ''; result.value = undefined; copied.value = '' }
</script>

<template>
  <section class="tool-page" aria-labelledby="tool-title">
    <header class="tool-heading"><span class="category">{{ t(`categories.${tool.category}`) }}</span><h1 id="tool-title">{{ t(tool.nameKey) }}</h1><p>{{ t(tool.descriptionKey) }}</p></header>
    <div class="io-panel">
      <div class="terminal-titlebar"><span class="window-marks" aria-hidden="true"><i /><i /><i /></span><span>[ unicode-inspector ]</span></div>
      <div class="io-strip"><span class="byte-count">{{ inputBytes }} B</span><div class="strip-actions"><button class="text-button" type="button" @click="clear">{{ t('common.clear') }}</button></div></div>
      <p class="notice warning" role="note">{{ t('tools.unicodeinspect.disclaimer') }}</p>
      <p v-if="isOverLimit" id="unicode-limit" class="notice warning" role="alert">{{ t('common.inputTooLarge', { size: '64 KiB' }) }}</p>
      <div class="field input-field">
        <label for="unicode-input"><span aria-hidden="true">$</span> {{ t('common.input') }}</label>
        <div class="terminal-editor input-editor"><span class="editor-prompt" aria-hidden="true">$</span><textarea id="unicode-input" v-model="input" rows="8" :placeholder="t('tools.unicodeinspect.placeholder')" spellcheck="false" :aria-describedby="isOverLimit ? 'unicode-limit' : 'unicode-help'" /></div>
        <span id="unicode-help" class="sr-only">{{ t('tools.unicodeinspect.inputHelp') }}</span>
      </div>

      <div v-if="result" class="results" aria-live="polite">
        <section class="output-card" aria-labelledby="characters-title"><header><h2 id="characters-title">{{ t('tools.unicodeinspect.sections.characters') }}</h2><button class="text-button" type="button" :disabled="!sections.characters" @click="copySection('characters')">{{ copied === 'characters' ? t('common.copied') : t('common.copy') }}</button></header><div class="scroll"><table><thead><tr><th scope="col">{{ t('tools.unicodeinspect.columns.position') }}</th><th scope="col">{{ t('tools.unicodeinspect.columns.character') }}</th><th scope="col">{{ t('tools.unicodeinspect.columns.codePoint') }}</th><th scope="col">{{ t('tools.unicodeinspect.columns.category') }}</th><th scope="col">{{ t('tools.unicodeinspect.columns.script') }}</th><th scope="col">ASCII</th></tr></thead><tbody><tr v-for="item in result.characters" :key="item.position"><td>{{ item.position }}</td><td><code>{{ item.character }}</code></td><td><code>{{ item.codePoint }}</code></td><td>{{ item.category }}</td><td>{{ item.script }}</td><td>{{ item.ascii ? t('tools.unicodeinspect.yes') : t('tools.unicodeinspect.no') }}</td></tr></tbody></table></div></section>
        <section class="output-card" aria-labelledby="observations-title"><header><h2 id="observations-title">{{ t('tools.unicodeinspect.sections.observations') }}</h2><button class="text-button" type="button" @click="copySection('observations')">{{ copied === 'observations' ? t('common.copied') : t('common.copy') }}</button></header><p>{{ t('tools.unicodeinspect.scriptsPresent') }}: <strong>{{ result.scripts.join(', ') || t('tools.unicodeinspect.none') }}</strong></p><p>{{ result.mixedScript ? t('tools.unicodeinspect.mixedNote', { scripts: result.scripts.filter((item) => !['Common', 'Inherited', 'Unknown'].includes(item)).join(', ') }) : t('tools.unicodeinspect.singleNote') }}</p><ul v-if="result.confusables.length"><li v-for="item in result.confusables" :key="item.position">{{ t('tools.unicodeinspect.confusableNote', { ...item }) }}</li></ul><p v-else>{{ t('tools.unicodeinspect.noConfusables') }}</p></section>
        <section class="output-card" aria-labelledby="invisibles-title"><header><h2 id="invisibles-title">{{ t('tools.unicodeinspect.sections.invisibles') }}</h2><button class="text-button" type="button" :disabled="!sections.invisibles" @click="copySection('invisibles')">{{ copied === 'invisibles' ? t('common.copied') : t('common.copy') }}</button></header><ul v-if="result.invisibles.length"><li v-for="item in result.invisibles" :key="item.position"><code>{{ item.codePoint }}</code> — {{ item.name }} · {{ t('tools.unicodeinspect.positionValue', { position: item.position }) }}</li></ul><p v-else>{{ t('tools.unicodeinspect.noInvisibles') }}</p></section>
        <section class="output-card" aria-labelledby="normalization-title"><header><h2 id="normalization-title">{{ t('tools.unicodeinspect.sections.normalization') }}</h2><button class="text-button" type="button" @click="copySection('normalization')">{{ copied === 'normalization' ? t('common.copied') : t('common.copy') }}</button></header><dl><dt>NFC · {{ result.normalization.nfcChanged ? t('tools.unicodeinspect.changed') : t('tools.unicodeinspect.unchanged') }}</dt><dd><pre tabindex="0">{{ result.normalization.nfc }}</pre></dd><dt>NFKC · {{ result.normalization.nfkcChanged ? t('tools.unicodeinspect.changed') : t('tools.unicodeinspect.unchanged') }}</dt><dd><pre tabindex="0">{{ result.normalization.nfkc }}</pre></dd></dl></section>
        <section class="output-card" aria-labelledby="decodes-title"><header><h2 id="decodes-title">{{ t('tools.unicodeinspect.sections.decodes') }}</h2><button class="text-button" type="button" @click="copySection('decodes')">{{ copied === 'decodes' ? t('common.copied') : t('common.copy') }}</button></header><article v-for="item in result.decodes" :key="item.kind" class="decode"><h3>{{ t(`tools.unicodeinspect.decodeKinds.${item.kind}`) }} · {{ item.changed ? t('tools.unicodeinspect.changed') : t('tools.unicodeinspect.unchanged') }}</h3><pre tabindex="0">{{ item.value }}</pre><p v-if="item.error" class="notice">{{ t('tools.unicodeinspect.decodeError') }}: {{ item.error }}</p></article></section>
      </div>
    </div>
  </section>
</template>

<style scoped>
.input-field{padding:1rem}.input-field textarea{min-height:10rem}.results{display:grid;gap:1rem;padding:0 1rem 1rem}.output-card{border:1px solid var(--border);min-width:0}.output-card>header{align-items:center;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;padding:.55rem .75rem}.output-card h2,.output-card h3{font-size:1rem;margin:0}.output-card h3{padding:.65rem .75rem}.output-card p,.output-card ul,.output-card dl{margin:.75rem 1rem}.scroll{overflow:auto}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid var(--border);padding:.5rem .65rem;text-align:left;vertical-align:top}th{font-family:var(--font-mono);white-space:nowrap}code,pre{font-family:var(--font-mono)}pre{background:var(--surface);margin:0;overflow:auto;padding:.75rem;white-space:pre-wrap;word-break:break-word}dl{display:grid;gap:.4rem}dt{font-family:var(--font-mono)}dd{border:1px solid var(--border);margin:0}.decode{border-top:1px solid var(--border)}.decode:first-of-type{border-top:0}button:focus-visible,textarea:focus-visible,pre:focus-visible{outline:2px solid var(--accent);outline-offset:2px}@media(max-width:600px){.output-card>header{align-items:flex-start;gap:.5rem}.results{padding-inline:.5rem}}
</style>
