<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { toolRegistry } from '../tools/registry'

const { t } = useI18n()
</script>

<template>
  <section aria-labelledby="home-title">
    <div class="hero">
      <p class="eyebrow">SOC-Tools</p>
      <h1 id="home-title">{{ t('home.title') }}</h1>
      <p>{{ t('home.intro') }}</p>
    </div>
    <ul class="tool-grid" :aria-label="t('app.tools')">
      <li v-for="tool in toolRegistry" :key="tool.id">
        <RouterLink class="tool-card" :to="tool.routePath" :aria-label="t('home.openTool', { name: t(tool.nameKey) })">
          <span class="category">{{ t(`categories.${tool.category}`) }}</span>
          <strong>{{ t(tool.nameKey) }}</strong>
          <span>{{ t(tool.descriptionKey) }}</span>
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" /></svg>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>
