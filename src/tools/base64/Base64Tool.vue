<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getTool } from '../registry'
import { useToolProcessing } from '../useToolProcessing'
import { decodeBase64, encodeBase64, type Base64Variant } from './base64'

const { t } = useI18n()
const tool = getTool('soc-tools.base64')
const input = ref('')
const output = ref('')
const error = ref('')
const mode = ref<'encode' | 'decode'>('encode')
const variant = ref<Base64Variant>('base64')
const copied = ref(false)
const formattedLimit = computed(() => `${tool.recommendedMaxInputBytes / 1_000_000} MB`)

function transform() {
  error.value = ''
  copied.value = false
  if (!input.value) {
    output.value = ''
    return
  }
  try {
    output.value = mode.value === 'encode'
      ? encodeBase64(input.value, variant.value)
      : decodeBase64(input.value, variant.value)
  } catch {
    output.value = ''
    error.value = t('tools.base64.invalid', { variant: t(`tools.base64.${variant.value === 'base64' ? 'standard' : 'url'}`) })
  }
}
const { inputBytes, isOverLimit, schedule: scheduleTransform } = useToolProcessing({
  input, output, error, maxInputBytes: tool.recommendedMaxInputBytes, process: transform,
})

function clear() {
  input.value = ''
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
    <header class="tool-heading">
      <span class="category">{{ t(`categories.${tool.category}`) }}</span>
      <h1 id="tool-title">{{ t(tool.nameKey) }}</h1>
      <p>{{ t(tool.descriptionKey) }}</p>
    </header>
    <div class="io-panel">
      <div class="terminal-titlebar">
        <span class="window-marks" aria-hidden="true"><i /><i /><i /></span>
        <span>[ base64 ]</span>
      </div>
      <div class="io-strip">
        <fieldset>
          <legend>{{ t('tools.base64.mode') }}</legend>
          <label class="radio-control"><input v-model="mode" type="radio" value="encode" @change="scheduleTransform" /><span>{{ t('tools.base64.encode') }}</span></label>
          <label class="radio-control"><input v-model="mode" type="radio" value="decode" @change="scheduleTransform" /><span>{{ t('tools.base64.decode') }}</span></label>
        </fieldset>
        <span class="strip-divider" aria-hidden="true" />
        <fieldset>
          <legend>{{ t('tools.base64.variant') }}</legend>
          <label class="radio-control"><input v-model="variant" type="radio" value="base64" @change="scheduleTransform" /><span>{{ t('tools.base64.standard') }}</span></label>
          <label class="radio-control"><input v-model="variant" type="radio" value="base64url" @change="scheduleTransform" /><span>{{ t('tools.base64.url') }}</span></label>
        </fieldset>
        <span class="byte-count">{{ t('tools.base64.bytes', { count: inputBytes }) }}</span>
        <div class="strip-actions">
          <button class="icon-button" type="button" :disabled="!output" :aria-label="copied ? t('tools.base64.copied') : t('tools.base64.copy')" @click="copyOutput">
            <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" /></svg>
          </button>
          <button class="icon-button" type="button" :aria-label="t('tools.base64.clear')" @click="clear">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14M10 10v6m4-6v6" /></svg>
          </button>
        </div>
      </div>
      <p v-if="isOverLimit" class="notice warning" role="alert">{{ t('common.inputTooLarge', { size: formattedLimit }) }}</p>
      <div class="editor-grid">
        <div class="field">
          <label for="base64-input"><span aria-hidden="true">$</span> {{ t('tools.base64.input') }}</label>
          <div class="terminal-editor input-editor"><span class="editor-prompt" aria-hidden="true">$</span><textarea id="base64-input" v-model="input" :class="{ invalid: error }" :aria-invalid="Boolean(error)" :aria-describedby="error ? 'base64-error' : undefined" :placeholder="t('tools.base64.inputPlaceholder')" spellcheck="false" @input="scheduleTransform" /><span class="fake-caret" aria-hidden="true" /></div>
        </div>
        <div class="field">
          <label for="base64-output"><span aria-hidden="true">&gt;</span> {{ t('tools.base64.output') }}</label>
          <div class="terminal-editor"><span class="editor-prompt" aria-hidden="true">&gt;</span><textarea id="base64-output" :value="output" :placeholder="t('tools.base64.outputPlaceholder')" readonly /></div>
        </div>
      </div>
      <p v-if="error" id="base64-error" class="notice error" role="alert">{{ error }}</p>
    </div>
  </section>
</template>
