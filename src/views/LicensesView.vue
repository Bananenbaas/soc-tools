<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { pluginLicenses } from '../plugins'

const { t } = useI18n()
</script>

<template>
  <section class="licenses-view">
    <div class="licenses-heading">
      <span class="category">{{ t('licenses.kicker') }}</span>
      <h1>{{ t('licenses.title') }}</h1>
      <p>{{ t('licenses.intro') }}</p>
    </div>
    <div class="license-panel">
      <ul class="license-list">
        <li v-for="plugin in pluginLicenses" :key="plugin.name" class="license-row">
          <span class="license-name">{{ plugin.name }}</span>
          <span class="license-version">v{{ plugin.version }}</span>
          <span class="license-id">{{ plugin.license }}</span>
        </li>
      </ul>
      <p class="license-note">{{ t('licenses.note') }}</p>
    </div>
  </section>
</template>
