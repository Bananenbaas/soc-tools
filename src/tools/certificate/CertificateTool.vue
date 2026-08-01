<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToolProcessing } from '../useToolProcessing'
import { inspectCertificate, type CertificateInspection } from './certificate'

const { t } = useI18n()
const tool = { nameKey: 'tools.certificate.name', descriptionKey: 'tools.certificate.description', category: 'inspection', recommendedMaxInputBytes: 65_536 }
const input = ref('')
const output = ref('')
const error = ref('')
const inspection = ref<CertificateInspection>()
const copied = ref('')
let generation = 0

function validityNote(item: CertificateInspection): string {
  if (item.validity.state === 'before') return t('tools.certificate.validityBefore', { days: item.validity.days })
  if (item.validity.state === 'after') return t('tools.certificate.validityAfter', { days: item.validity.days })
  return t('tools.certificate.validityWithin', { days: item.validity.days })
}
function dateText(label: string, value: CertificateInspection['validity']['notBeforeFormatted']): string {
  return `${label}\n  UTC: ${value.utc}\n  Europe/Amsterdam: ${value.amsterdam}`
}
const sections = computed(() => {
  const item = inspection.value
  if (!item) return []
  const summary = [
    `${t('tools.certificate.subjectCn')}: ${item.subject.commonName ?? t('tools.certificate.notPresent')}`,
    `${t('tools.certificate.issuerCn')}: ${item.issuer.commonName ?? t('tools.certificate.notPresent')}`,
    `${t('tools.certificate.version')}: X.509 v${item.version}`,
    `${t('tools.certificate.serial')}: ${item.serialHex}`,
    `${t('tools.certificate.signatureAlgorithm')}: ${item.signatureAlgorithm.name} (${item.signatureAlgorithm.oid})`,
    dateText(t('tools.certificate.notBefore'), item.validity.notBeforeFormatted), dateText(t('tools.certificate.notAfter'), item.validity.notAfterFormatted), validityNote(item),
    item.pemBlockCount > 1 ? t('tools.certificate.multipleBlocks', { count: item.pemBlockCount }) : '',
  ].filter(Boolean).join('\n')
  const names = [`${t('tools.certificate.subject')}: ${item.subject.text}`, ...item.subject.attributes.map((entry) => `  ${entry.label} (${entry.oid}): ${entry.value}`), '', `${t('tools.certificate.issuer')}: ${item.issuer.text}`, ...item.issuer.attributes.map((entry) => `  ${entry.label} (${entry.oid}): ${entry.value}`)].join('\n')
  const sans = item.subjectAlternativeNames.length ? item.subjectAlternativeNames.map((entry) => `${entry.type}: ${entry.value}`).join('\n') : t('tools.certificate.noneFound')
  const usage = [`${t('tools.certificate.keyUsage')}:`, ...(item.keyUsage.length ? item.keyUsage.map((entry) => `- ${entry}`) : [`- ${t('tools.certificate.noneFound')}`]), '', `${t('tools.certificate.extendedKeyUsage')}:`, ...(item.extendedKeyUsage.length ? item.extendedKeyUsage.map((entry) => `- ${entry}`) : [`- ${t('tools.certificate.noneFound')}`])].join('\n')
  const publicKey = [`${t('tools.certificate.algorithm')}: ${item.publicKey.algorithm} (${item.publicKey.algorithmOid})`, item.publicKey.keySize ? `${t('tools.certificate.keySize')}: ${item.publicKey.keySize} ${t('tools.certificate.bits')}` : '', item.publicKey.curve ? `${t('tools.certificate.curve')}: ${item.publicKey.curve}` : ''].filter(Boolean).join('\n')
  const constraints = item.basicConstraints ? `${t('tools.certificate.ca')}: ${item.basicConstraints.ca ? t('tools.certificate.yes') : t('tools.certificate.no')}${item.basicConstraints.pathLength === undefined ? '' : `\n${t('tools.certificate.pathLength')}: ${item.basicConstraints.pathLength}`}` : t('tools.certificate.noneFound')
  const fingerprints = [`SHA-1: ${item.fingerprints.sha1 ?? t('tools.certificate.unavailable')}`, `SHA-256: ${item.fingerprints.sha256 ?? t('tools.certificate.unavailable')}`].join('\n')
  const undecoded = item.undecodedExtensionOids.length ? item.undecodedExtensionOids.join('\n') : t('tools.certificate.noneFound')
  return [
    { id: 'summary', title: t('tools.certificate.sections.summary'), text: summary }, { id: 'names', title: t('tools.certificate.sections.names'), text: names },
    { id: 'sans', title: t('tools.certificate.sections.sans'), text: sans }, { id: 'usage', title: t('tools.certificate.sections.usage'), text: usage },
    { id: 'public-key', title: t('tools.certificate.sections.publicKey'), text: publicKey }, { id: 'constraints', title: t('tools.certificate.sections.constraints'), text: constraints },
    { id: 'fingerprints', title: t('tools.certificate.sections.fingerprints'), text: fingerprints }, { id: 'undecoded', title: t('tools.certificate.sections.undecoded'), text: undecoded },
  ]
})

async function process() {
  const current = ++generation
  const result = await inspectCertificate(input.value)
  if (current !== generation) return
  copied.value = ''
  if (!result.ok) { inspection.value = undefined; output.value = ''; error.value = t('tools.certificate.invalid'); return }
  error.value = ''; inspection.value = result.value; output.value = 'parsed'
}
const { inputBytes, isOverLimit, schedule, cancelPending } = useToolProcessing({ input, output, error, maxInputBytes: tool.recommendedMaxInputBytes, process, cancel: () => { generation++ } })
function clear() { cancelPending(); input.value = ''; output.value = ''; error.value = ''; inspection.value = undefined; copied.value = '' }
async function copySection(id: string, text: string) { await navigator.clipboard.writeText(text); copied.value = id }
</script>

<template>
  <section class="tool-page" aria-labelledby="tool-title">
    <header class="tool-heading"><span class="category">{{ t(`categories.${tool.category}`) }}</span><h1 id="tool-title">{{ t(tool.nameKey) }}</h1><p>{{ t(tool.descriptionKey) }}</p></header>
    <div class="io-panel">
      <div class="terminal-titlebar"><span class="window-marks" aria-hidden="true"><i /><i /><i /></span><span>[ certificate ]</span></div>
      <div class="io-strip"><span class="byte-count">{{ inputBytes }} B</span><button class="text-button" type="button" @click="clear">{{ t('tools.certificate.clear') }}</button></div>
      <p class="notice warning" role="note">{{ t('tools.certificate.disclaimer') }}</p>
      <p v-if="isOverLimit" class="notice warning" role="alert">{{ t('common.inputTooLarge', { size: '64 KiB' }) }}</p>
      <div class="field input-field"><label for="certificate-input"><span>$</span> {{ t('tools.certificate.inputLabel') }}</label><div class="terminal-editor input-editor"><span class="editor-prompt" aria-hidden="true">$</span><textarea id="certificate-input" v-model="input" rows="10" :class="{ invalid: error }" :aria-invalid="Boolean(error)" :aria-describedby="error ? 'certificate-error' : 'certificate-help'" :placeholder="t('tools.certificate.placeholder')" spellcheck="false" @input="schedule" /></div><p id="certificate-help" class="help">{{ t('tools.certificate.inputHelp') }}</p></div>
      <p v-if="error" id="certificate-error" class="notice error" role="alert">{{ error }}</p>
      <section v-if="sections.length" class="results" :aria-label="t('common.output')" aria-live="polite">
        <article v-for="section in sections" :key="section.id" class="result-card"><header><h2>{{ section.title }}</h2><button class="text-button" type="button" :aria-label="`${t('common.copy')}: ${section.title}`" @click="copySection(section.id, section.text)">{{ copied === section.id ? t('common.copied') : t('common.copy') }}</button></header><pre tabindex="0">{{ section.text }}</pre></article>
      </section>
    </div>
  </section>
</template>

<style scoped>
.io-strip{justify-content:space-between}.input-field{padding:1rem}.input-field label{display:block;margin-bottom:.4rem}.input-field label span{color:var(--accent)}textarea{min-height:12rem;resize:vertical}.help{color:var(--text-muted);font-size:.875rem;margin:.45rem 0 0}.results{display:grid;gap:1rem;padding:1rem}.result-card{border:1px solid var(--border);min-width:0}.result-card header{align-items:center;display:flex;gap:1rem;justify-content:space-between;padding:.55rem .75rem}.result-card h2{font-size:1rem;margin:0}.result-card pre{background:var(--surface);border-top:1px solid var(--border);margin:0;overflow:auto;padding:1rem;white-space:pre-wrap;word-break:break-word}button:focus-visible,textarea:focus-visible,pre:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
</style>
