<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getTool } from '../registry'
import { useToolProcessing } from '../useToolProcessing'
import { calculateCidr, classifyIp, isIpInCidr } from './ipcidr'

const { t } = useI18n()
const tool = getTool('soc-tools.ipcidr')
const address = ref('')
const membershipIp = ref('')
const processingInput = computed(() => `${address.value}\n${membershipIp.value}`)
const output = ref('')
const error = ref('')
const copied = ref(false)

function renderOutput(): string {
  const info = calculateCidr(address.value)
  const classification = classifyIp(info.address)
  const lines = [
    `[ ${t('tools.ipcidr.sections.summary')} ]`,
    `${t('tools.ipcidr.fields.version')}: IPv${info.version}`,
    `${t('tools.ipcidr.fields.address')}: ${info.address}`,
    `${t('tools.ipcidr.fields.prefix')}: /${info.prefixLength}`,
    `${t('tools.ipcidr.fields.network')}: ${info.network}`,
  ]
  if (info.version === 4) {
    lines.push(
      `${t('tools.ipcidr.fields.broadcast')}: ${info.broadcast}`,
      `${t('tools.ipcidr.fields.hostRange')}: ${info.firstUsable} – ${info.lastUsable}`,
      `${t('tools.ipcidr.fields.netmask')}: ${info.netmask}`,
      `${t('tools.ipcidr.fields.wildcard')}: ${info.wildcard}`,
      `${t('tools.ipcidr.fields.total')}: ${info.totalAddresses}`,
      `${t('tools.ipcidr.fields.usable')}: ${info.usableCount}`,
    )
  } else {
    lines.push(
      `${t('tools.ipcidr.fields.firstAddress')}: ${info.firstAddress}`,
      `${t('tools.ipcidr.fields.lastAddress')}: ${info.lastAddress}`,
      `${t('tools.ipcidr.fields.total')}: ${info.totalAddresses}`,
      `${t('tools.ipcidr.fields.compressed')}: ${info.address}`,
      `${t('tools.ipcidr.fields.expanded')}: ${info.expanded}`,
      `${t('tools.ipcidr.fields.networkExpanded')}: ${info.networkExpanded}`,
    )
  }
  lines.push('', `[ ${t('tools.ipcidr.sections.classification')} ]`, `${t(`tools.ipcidr.classifications.${classification.kind}`)} — ${classification.matchedRange}`)
  if (membershipIp.value.trim()) {
    const inside = isIpInCidr(membershipIp.value.trim(), address.value)
    lines.push('', `[ ${t('tools.ipcidr.sections.membership')} ]`, t(inside ? 'tools.ipcidr.membershipInside' : 'tools.ipcidr.membershipOutside', { ip: membershipIp.value.trim(), cidr: `${info.network}/${info.prefixLength}` }))
  }
  return lines.join('\n')
}

function process() {
  error.value = ''
  copied.value = false
  if (!address.value.trim()) { output.value = ''; return }
  try { output.value = renderOutput() } catch { output.value = ''; error.value = t('tools.ipcidr.invalid') }
}

const { inputBytes, isOverLimit, schedule, cancelPending } = useToolProcessing({ input: processingInput, output, error, maxInputBytes: tool.recommendedMaxInputBytes, process })
watch([address, membershipIp], schedule, { immediate: true })

function clear() {
  cancelPending()
  address.value = ''
  membershipIp.value = ''
  output.value = ''
  error.value = ''
  copied.value = false
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
      <div class="terminal-titlebar"><span class="window-marks" aria-hidden="true"><i /><i /><i /></span><span>[ ip-cidr ]</span></div>
      <div class="io-strip"><span class="byte-count">{{ inputBytes }} B</span><div class="strip-actions"><button class="icon-button" type="button" :disabled="!output" :aria-label="copied ? t('common.copied') : t('common.copy')" @click="copyOutput"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" /></svg></button><button class="icon-button" type="button" :aria-label="t('common.clear')" @click="clear"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" /></svg></button></div></div>
      <p class="notice" role="note">{{ t('tools.ipcidr.disclaimer') }}</p>
      <p v-if="isOverLimit" class="notice warning" role="alert">{{ t('common.inputTooLarge', { size: '4 KB' }) }}</p>
      <div class="editor-grid">
        <div class="field"><label for="ipcidr-input"><span>$</span> {{ t('tools.ipcidr.addressLabel') }}</label><div class="terminal-editor input-editor"><span class="editor-prompt" aria-hidden="true">$</span><textarea id="ipcidr-input" v-model="address" :class="{ invalid: error }" :aria-invalid="Boolean(error)" :aria-describedby="error ? 'ipcidr-error' : 'ipcidr-help'" :placeholder="t('tools.ipcidr.addressPlaceholder')" spellcheck="false" /></div><p id="ipcidr-help" class="field-help">{{ t('tools.ipcidr.addressHelp') }}</p></div>
        <div class="field"><label for="ipcidr-membership"><span>?</span> {{ t('tools.ipcidr.membershipLabel') }}</label><div class="terminal-editor input-editor"><span class="editor-prompt" aria-hidden="true">?</span><textarea id="ipcidr-membership" v-model="membershipIp" :aria-describedby="error ? 'ipcidr-error' : undefined" :placeholder="t('tools.ipcidr.membershipPlaceholder')" spellcheck="false" /></div></div>
      </div>
      <div class="field output-field"><label for="ipcidr-output"><span>&gt;</span> {{ t('common.output') }}</label><div class="terminal-editor"><span class="editor-prompt" aria-hidden="true">&gt;</span><textarea id="ipcidr-output" :value="output" :placeholder="t('common.result')" readonly /></div></div>
      <p v-if="error" id="ipcidr-error" class="notice error" role="alert">{{ error }}</p>
    </div>
  </section>
</template>

<style scoped>
.field-help{color:var(--text-muted);font-size:.875rem;margin:.4rem 0 0}.output-field{border-top:1px solid var(--border);padding:1rem}.output-field textarea{min-height:20rem}.terminal-editor textarea:focus-visible,button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}@media(max-width:700px){.output-field{padding:.75rem}}
</style>
