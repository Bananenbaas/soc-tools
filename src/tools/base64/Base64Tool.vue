<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getTool } from '../registry'
import { decodeBase64, encodeBase64, type Base64Variant } from './base64'

const { t } = useI18n()
const tool = getTool('soc-tools.base64')
const input = ref('')
const output = ref('')
const error = ref('')
const mode = ref<'encode' | 'decode'>('encode')
const variant = ref<Base64Variant>('base64')
const copied = ref(false)
const inputBytes = computed(() => new TextEncoder().encode(input.value).byteLength)
const isOverLimit = computed(() => inputBytes.value > tool.recommendedMaxInputBytes)
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
    <div class="option-grid">
      <fieldset>
        <legend>{{ t('tools.base64.mode') }}</legend>
        <label><input v-model="mode" type="radio" value="encode" @change="transform" /> {{ t('tools.base64.encode') }}</label>
        <label><input v-model="mode" type="radio" value="decode" @change="transform" /> {{ t('tools.base64.decode') }}</label>
      </fieldset>
      <fieldset>
        <legend>{{ t('tools.base64.variant') }}</legend>
        <label><input v-model="variant" type="radio" value="base64" @change="transform" /> {{ t('tools.base64.standard') }}</label>
        <label><input v-model="variant" type="radio" value="base64url" @change="transform" /> {{ t('tools.base64.url') }}</label>
      </fieldset>
    </div>
    <p v-if="isOverLimit" class="notice warning" role="status">
      {{ t('tools.base64.warning', { size: formattedLimit }) }}
    </p>
    <div class="editor-grid">
      <div class="field">
        <div class="field-heading">
          <label for="base64-input">{{ t('tools.base64.input') }}</label>
          <button class="secondary-button" type="button" @click="clear">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14M10 10v6m4-6v6" /></svg>
            {{ t('tools.base64.clear') }}
          </button>
        </div>
        <textarea id="base64-input" v-model="input" :placeholder="t('tools.base64.inputPlaceholder')" spellcheck="false" @input="transform" />
      </div>
      <div class="field">
        <div class="field-heading">
          <label for="base64-output">{{ t('tools.base64.output') }}</label>
          <button class="secondary-button" type="button" :disabled="!output" @click="copyOutput">
            <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" /></svg>
            {{ copied ? t('tools.base64.copied') : t('tools.base64.copy') }}
          </button>
        </div>
        <textarea id="base64-output" :value="output" :placeholder="t('tools.base64.outputPlaceholder')" readonly />
      </div>
    </div>
    <p v-if="error" class="notice error" role="alert">{{ error }}</p>
  </section>
</template>
