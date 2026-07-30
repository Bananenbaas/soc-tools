<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

type Theme = 'light' | 'dark'

const { locale, t } = useI18n()
const initialTheme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
const theme = ref<Theme>(initialTheme)
const textSize = ref(Number.parseInt(document.documentElement.dataset.textSize ?? '16', 10))
const nextTheme = computed<Theme>(() => (theme.value === 'dark' ? 'light' : 'dark'))

watch(theme, (value) => {
  document.documentElement.dataset.theme = value
  localStorage.setItem('soc-tools-theme', value)
})

function toggleTheme() {
  theme.value = nextTheme.value
}

function adjustTextSize(change: number) {
  textSize.value = Math.min(20, Math.max(14, textSize.value + change))
  document.documentElement.dataset.textSize = String(textSize.value)
  localStorage.setItem('soc-tools-text-size', String(textSize.value))
}

function setLocale(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  locale.value = value === 'nl' ? 'nl' : 'en'
  document.documentElement.lang = locale.value
  localStorage.setItem('soc-tools-locale', locale.value)
}
</script>

<template>
  <a class="skip-link" href="#main-content">{{ t('app.skip') }}</a>
  <header class="site-header">
    <div class="shell header-content">
      <RouterLink class="brand" to="/">SOC-Tools</RouterLink>
      <nav class="controls" :aria-label="t('app.controls')">
        <a
          class="icon-button github-link"
          href="https://github.com/Bananenbaas/soc-tools"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="t('app.github')"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M15 7h2v2m0-2-5 5m5-1v5a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h5" />
          </svg>
          <span>GitHub</span>
        </a>
        <button class="icon-button" type="button" :aria-label="t('app.theme', { theme: t(`app.${nextTheme}`) })" @click="toggleTheme">
          <svg v-if="theme === 'dark'" aria-hidden="true" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
          </svg>
          <svg v-else aria-hidden="true" viewBox="0 0 24 24">
            <path d="M20 15.3A9 9 0 1 1 8.7 4a7 7 0 0 0 11.3 11.3Z" />
          </svg>
        </button>
        <div class="text-controls">
          <button type="button" :aria-label="t('app.smallerText')" @click="adjustTextSize(-1)">A−</button>
          <button type="button" :aria-label="t('app.largerText')" @click="adjustTextSize(1)">A+</button>
        </div>
        <label class="language-control">
          <span class="sr-only">{{ t('app.language') }}</span>
          <select :value="locale" :aria-label="t('app.language')" @change="setLocale">
            <option value="en">EN</option>
            <option value="nl">NL</option>
          </select>
        </label>
      </nav>
    </div>
  </header>
  <main id="main-content" class="shell main-content" tabindex="-1">
    <RouterView />
  </main>
  <footer class="site-footer">
    <div class="shell">{{ t('app.footer') }}</div>
  </footer>
</template>
