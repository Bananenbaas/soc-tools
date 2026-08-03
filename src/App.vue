<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { toolFilter } from './toolFilter'
import { toolRegistry } from './tools/registry'
import { defaultThemeName, themeRegistry } from './themes/registry'

type ThemeMode = 'light' | 'dark'

const { locale, t } = useI18n()
const route = useRoute()
const modeQuery = window.matchMedia('(prefers-color-scheme: dark)')
const initialMode = document.documentElement.dataset.theme
const explicitThemeMode = ref<ThemeMode | null>(initialMode === 'dark' || initialMode === 'light' ? initialMode : null)
const systemThemeMode = ref<ThemeMode>(modeQuery.matches ? 'dark' : 'light')
const effectiveThemeMode = computed(() => explicitThemeMode.value ?? systemThemeMode.value)
const themeName = ref(document.documentElement.dataset.themeName ?? defaultThemeName)
const textSize = ref(Number.parseInt(document.documentElement.dataset.textSize ?? '16', 10))
const drawerOpen = ref(false)
const controlsOpen = ref(false)
const searchOpen = ref(false)
const version = __APP_VERSION__
const filteredTools = computed(() => {
  const query = toolFilter.value.trim().toLocaleLowerCase(locale.value)
  return query
    ? toolRegistry.filter((tool) => `${t(tool.nameKey)} ${t(tool.descriptionKey)} ${t(`categories.${tool.category}`)}`.toLocaleLowerCase(locale.value).includes(query))
    : toolRegistry
})
const groupedTools = computed(() => {
  const groups = new Map<string, (typeof toolRegistry)[number][]>()
  for (const tool of filteredTools.value) {
    const group = groups.get(tool.category) ?? []
    group.push(tool)
    groups.set(tool.category, group)
  }
  return [...groups.entries()]
})

watch(explicitThemeMode, (value) => {
  if (!value) return
  document.documentElement.dataset.theme = value
  localStorage.setItem('soc-tools-theme', value)
})

watch(themeName, (value) => {
  const selected = themeRegistry.some((theme) => theme.id === value) ? value : defaultThemeName
  document.documentElement.dataset.themeName = selected
  localStorage.setItem('soc-tools-theme-name', selected)
})

watch(() => route.fullPath, () => {
  drawerOpen.value = false
  controlsOpen.value = false
  searchOpen.value = false
})

function updateSystemTheme(event: MediaQueryListEvent) {
  systemThemeMode.value = event.matches ? 'dark' : 'light'
}

modeQuery.addEventListener('change', updateSystemTheme)
onBeforeUnmount(() => modeQuery.removeEventListener('change', updateSystemTheme))

function toggleThemeMode() {
  explicitThemeMode.value = effectiveThemeMode.value === 'dark' ? 'light' : 'dark'
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

function setThemeName(event: Event) {
  themeName.value = (event.target as HTMLSelectElement).value
}
</script>

<template>
  <a class="skip-link" href="#main-content">{{ t('app.skip') }}</a>
  <header class="topbar">
    <div class="brand-group">
      <button class="icon-button drawer-toggle" type="button" :aria-label="t('app.drawerToggle')" :aria-expanded="drawerOpen" @click="drawerOpen = !drawerOpen">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      <RouterLink class="brand" to="/">SOC<span>-Tools</span></RouterLink>
      <a class="github-link" href="https://github.com/Bananenbaas/soc-tools" target="_blank" rel="noopener noreferrer" :aria-label="t('app.github')">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M15 7h2v2m0-2-5 5m5-1v5a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h5" /></svg><span>GitHub</span>
      </a>
    </div>
    <label class="tool-search" :class="{ open: searchOpen }">
      <span class="sr-only">{{ t('app.searchLabel') }}</span>
      <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>
      <input v-model="toolFilter" type="search" :placeholder="t('app.searchPlaceholder')" />
    </label>
    <button class="icon-button search-toggle" type="button" :aria-label="t('app.searchToggle')" :aria-expanded="searchOpen" @click="searchOpen = !searchOpen">
      <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>
    </button>
    <button class="icon-button controls-toggle" type="button" :aria-label="t('app.controls')" :aria-expanded="controlsOpen" @click="controlsOpen = !controlsOpen">
      <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></svg>
    </button>
    <nav class="controls" :class="{ open: controlsOpen }" :aria-label="t('app.controls')">
      <label class="theme-control">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 5h16M7 12h10M10 19h4" /></svg>
        <span class="sr-only">{{ t('app.themeName') }}</span>
        <select :value="themeName" :aria-label="t('app.themeName')" @change="setThemeName">
          <option v-for="theme in themeRegistry" :key="theme.id" :value="theme.id">{{ t(theme.nameKey) }}</option>
        </select>
      </label>
      <button class="icon-button" type="button" :aria-label="t(`app.switchTo.${effectiveThemeMode === 'dark' ? 'light' : 'dark'}`)" :title="t(`app.switchTo.${effectiveThemeMode === 'dark' ? 'light' : 'dark'}`)" @click="toggleThemeMode">
        <svg v-if="effectiveThemeMode === 'dark'" aria-hidden="true" viewBox="0 0 24 24"><path d="M20 15.3A9 9 0 1 1 8.7 4 7 7 0 0 0 20 15.3Z" /></svg>
        <svg v-else aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.5 1.5m11.2 11.2 1.5 1.5M2 12h2m16 0h2M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5" /></svg>
      </button>
      <button class="text-button" type="button" :aria-label="t('app.smallerText')" @click="adjustTextSize(-1)">A−</button>
      <button class="text-button" type="button" :aria-label="t('app.largerText')" @click="adjustTextSize(1)">A+</button>
      <label class="language-control">
        <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
        <span class="sr-only">{{ t('app.language') }}</span>
        <select :value="locale" :aria-label="t('app.language')" @change="setLocale"><option value="en">EN</option><option value="nl">NL</option></select>
      </label>
    </nav>
  </header>
  <div class="console-body">
    <div v-if="drawerOpen" class="drawer-scrim" aria-hidden="true" @click="drawerOpen = false" />
    <aside class="tool-rail" :class="{ open: drawerOpen }" :aria-label="t('app.tools')">
      <nav>
        <section v-for="[category, tools] in groupedTools" :key="category" class="rail-group">
          <h2>{{ t(`categories.${category}`) }}</h2>
          <RouterLink v-for="tool in tools" :key="tool.id" class="rail-item" :to="tool.routePath">
            <svg v-if="tool.icon" aria-hidden="true" :viewBox="tool.icon.viewBox"><path v-for="path in tool.icon.paths" :key="path" :d="path" /></svg>
            <span>{{ t(tool.nameKey) }}</span>
          </RouterLink>
        </section>
        <p v-if="!filteredTools.length" class="rail-empty">{{ t('home.noResults') }}</p>
      </nav>
      <div class="rail-note"><p>{{ t('app.localOnly') }}</p><p class="rail-version">v{{ version }}</p></div>
    </aside>
    <main id="main-content" class="workspace" tabindex="-1"><RouterView /></main>
  </div>
</template>

<style scoped>
.rail-note p{margin:0}.rail-version{margin-top:.25rem!important;color:var(--text-muted);font-family:var(--font-data);font-size:.75rem}
</style>
