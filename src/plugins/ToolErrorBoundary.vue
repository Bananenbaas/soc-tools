<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const failed = ref(false)
const { t } = useI18n()

onErrorCaptured(() => {
  failed.value = true
  return false
})
</script>

<template>
  <slot v-if="!failed" />
  <section v-else class="tool-error notice error" role="alert" aria-labelledby="tool-error-title">
    <h1 id="tool-error-title">{{ t('home.toolErrorTitle') }}</h1>
    <p>{{ t('home.toolErrorMessage') }}</p>
    <RouterLink to="/">{{ t('home.backHome') }}</RouterLink>
  </section>
</template>

<style scoped>
.tool-error { max-width: 48rem; margin: 2rem auto; padding: 1.5rem; background: var(--surface-raised); }
.tool-error h1 { margin-top: 0; }
.tool-error a { color: var(--accent-strong); }
</style>
