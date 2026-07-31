<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { toolFilter } from '../toolFilter'
import { toolRegistry } from '../tools/registry'

const { locale, t } = useI18n()
const filteredTools = computed(() => {
  const query = toolFilter.value.trim().toLocaleLowerCase(locale.value)
  return query
    ? toolRegistry.filter((tool) => `${t(tool.nameKey)} ${t(tool.descriptionKey)} ${t(`categories.${tool.category}`)}`.toLocaleLowerCase(locale.value).includes(query))
    : toolRegistry
})
</script>

<template>
  <section aria-labelledby="home-title">
    <header class="landing-header">
      <div class="landing-mark" aria-hidden="true"><span>&gt;_</span></div>
      <div class="catalog-heading">
        <h1 id="home-title">{{ t('home.title') }}</h1>
        <p>{{ t('home.intro') }}</p>
        <p class="prompt-motif" aria-hidden="true">&gt; {{ t('home.prompt') }}<span class="prompt-caret">_</span></p>
      </div>
      <div class="trust-note">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.6 2.9 8.1 7 10 4.1-1.9 7-5.4 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-5" /></svg>
        <span>{{ t('home.trust') }}</span>
      </div>
    </header>
    <p class="catalog-count">{{ t('home.resultCount', { count: filteredTools.length }) }}</p>
    <ul v-if="filteredTools.length" class="tool-grid" :aria-label="t('app.tools')">
      <li v-for="tool in filteredTools" :key="tool.id">
        <RouterLink class="tool-card" :to="tool.routePath" :aria-label="t('home.openTool', { name: t(tool.nameKey) })">
          <span class="tool-icon" aria-hidden="true"><svg v-if="tool.icon" :viewBox="tool.icon.viewBox"><path v-for="path in tool.icon.paths" :key="path" :d="path" /></svg></span>
          <span class="tool-card-copy"><strong>{{ t(tool.nameKey) }}</strong><span>{{ t(tool.descriptionKey) }}</span><span class="category">{{ t(`categories.${tool.category}`) }}</span></span>
          <svg class="card-arrow" aria-hidden="true" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" /></svg>
        </RouterLink>
      </li>
    </ul>
    <p v-else class="empty-state">{{ t('home.noResults') }}</p>
  </section>
</template>
