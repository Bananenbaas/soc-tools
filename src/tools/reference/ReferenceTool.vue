<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getTool } from '../registry'
import { filterReferenceEntries, getReferenceSection, referenceSections, type ReferenceEntry, type ReferenceSectionId } from './reference'

const { t } = useI18n()
const tool = getTool('soc-tools.reference')
const activeSection = ref<ReferenceSectionId>('connect')
const search = ref('')
const copiedCommand = ref<string | null>(null)
const copyFailed = ref(false)
const sectionButtons = ref<Record<string, HTMLButtonElement | null>>({})

const activeEntries = computed(() => getReferenceSection(activeSection.value).entries)
const searchResults = computed(() => filterReferenceEntries(search.value))
const displayedEntries = computed(() => search.value.trim() ? searchResults.value : activeEntries.value)
const resultSections = computed(() => search.value.trim()
  ? referenceSections.map((section) => ({ section, entries: section.entries.filter((entry) => searchResults.value.includes(entry)) })).filter((item) => item.entries.length)
  : [{ section: getReferenceSection(activeSection.value), entries: activeEntries.value }])

function selectSection(id: ReferenceSectionId) {
  activeSection.value = id
  void nextTick(() => sectionButtons.value[id]?.focus())
}

function moveSection(event: KeyboardEvent, index: number) {
  const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
  if (event.key === 'Home') { event.preventDefault(); selectSection(referenceSections[0].id); return }
  if (event.key === 'End') { event.preventDefault(); selectSection(referenceSections[referenceSections.length - 1].id); return }
  if (!direction) return
  event.preventDefault()
  selectSection(referenceSections[(index + direction + referenceSections.length) % referenceSections.length].id)
}

async function copyCommand(entry: ReferenceEntry) {
  copiedCommand.value = null
  copyFailed.value = false
  try {
    await navigator.clipboard.writeText(entry.command)
    copiedCommand.value = entry.command
  } catch {
    copyFailed.value = true
  }
}
</script>

<template>
  <section class="tool-page" aria-labelledby="tool-title">
    <header class="tool-heading"><span class="category">{{ t(`categories.${tool.category}`) }}</span><h1 id="tool-title">{{ t(tool.nameKey) }}</h1><p>{{ t(tool.descriptionKey) }}</p></header>
    <div class="reference-shell">
      <div class="terminal-titlebar"><span class="window-marks" aria-hidden="true"><i /><i /><i /></span><span>[ command-query-reference ]</span></div>
      <p class="notice" role="note">{{ t('tools.reference.disclaimer') }}</p>
      <div class="reference-controls">
        <nav class="section-nav" :aria-label="t('tools.reference.sectionsLabel')" role="tablist" @keydown="moveSection($event, referenceSections.findIndex((section) => section.id === activeSection))">
          <button v-for="(section, index) in referenceSections" :key="section.id" :ref="(element) => { sectionButtons[section.id] = element as HTMLButtonElement }" type="button" role="tab" :aria-selected="activeSection === section.id" :aria-controls="`reference-panel-${section.id}`" :tabindex="activeSection === section.id ? 0 : -1" @click="activeSection = section.id" @keydown="moveSection($event, index)">{{ t(`tools.reference.sections.${section.id}`) }}</button>
        </nav>
        <label class="search-label" for="reference-search">{{ t('tools.reference.searchLabel') }}<input id="reference-search" v-model="search" type="search" :placeholder="t('tools.reference.searchPlaceholder')" autocomplete="off" spellcheck="false"></label>
      </div>
      <p class="result-summary" aria-live="polite">{{ search.trim() ? t('tools.reference.searchCount', { count: displayedEntries.length }) : t('tools.reference.sectionCount', { count: activeEntries.length }) }}</p>
      <section :id="`reference-panel-${activeSection}`" class="reference-panel" role="tabpanel" :aria-label="t(`tools.reference.sections.${activeSection}`)">
        <template v-for="group in resultSections" :key="group.section.id">
          <h2 v-if="search.trim()" class="result-section-heading">{{ t(`tools.reference.sections.${group.section.id}`) }}</h2>
          <ul class="reference-list">
            <li v-for="entry in group.entries" :key="entry.command" class="reference-entry">
              <div class="entry-command"><code>{{ entry.command }}</code><button class="copy-button" type="button" :aria-label="t('tools.reference.copyLabel', { command: entry.command })" @click="copyCommand(entry)">{{ copiedCommand === entry.command ? t('tools.reference.copied') : t('tools.reference.copy') }}</button></div>
              <p>{{ entry.description }}</p>
              <span class="sr-status" aria-live="polite">{{ copiedCommand === entry.command ? t('tools.reference.copySuccess') : copyFailed ? t('tools.reference.copyFailure') : '' }}</span>
            </li>
          </ul>
        </template>
        <p v-if="!displayedEntries.length" class="empty-state">{{ t('tools.reference.noResults') }}</p>
      </section>
    </div>
  </section>
</template>

<style scoped>
.reference-shell{margin-top:24px;overflow:hidden;border:1px solid var(--border-hairline);border-radius:8px;background:var(--surface-raised);color:var(--text-primary)}
.terminal-titlebar{display:flex;min-height:36px;align-items:center;gap:10px;padding:0 14px;background:var(--io-strip);color:var(--text-secondary);font:650 .75rem var(--font-data);letter-spacing:.04em}
.window-marks{display:flex;gap:5px}.window-marks i{width:7px;height:7px;border:1px solid var(--border-strong);border-radius:50%}
.notice{margin:0;padding:12px 24px;border-bottom:1px solid var(--border-hairline);background:var(--surface-overlay);color:var(--text-muted);font-size:.875rem}
.reference-controls{display:grid;gap:16px;padding:16px 24px;border-bottom:1px solid var(--border-hairline);background:var(--surface-overlay)}
.section-nav{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
.section-nav button,.copy-button{min-height:44px;border:1px solid var(--border-strong);border-radius:5px;background:transparent;color:var(--text-secondary);font:inherit;cursor:pointer}
.section-nav button{padding:8px 10px;text-align:left}.section-nav button:hover{border-color:var(--accent);color:var(--text-primary)}.section-nav button[aria-selected=true]{border-color:var(--accent);background:var(--accent-muted);color:var(--accent-strong);font-weight:650}
.search-label{display:grid;gap:6px;color:var(--text-secondary);font-weight:650}.search-label input{box-sizing:border-box;width:100%;min-height:44px;padding:9px 10px;border:1px solid var(--border-strong);border-radius:5px;background:var(--surface-overlay);color:var(--text-primary);font:inherit}
.result-summary{margin:0;padding:10px 24px;color:var(--text-muted);font: .75rem var(--font-data)}
.reference-panel{padding:0 24px 24px}.result-section-heading{margin:18px 0 8px;color:var(--text-primary);font-size:1rem}.reference-list{display:grid;gap:8px;margin:0;padding:0;list-style:none}.reference-entry{padding:12px;border:1px solid var(--border-hairline);border-radius:5px;background:var(--surface-overlay)}.entry-command{display:flex;align-items:flex-start;gap:12px;justify-content:space-between}.entry-command code{min-width:0;overflow:auto;color:var(--text-primary);font: .875rem/1.5 var(--font-data);white-space:pre-wrap;overflow-wrap:anywhere}.copy-button{flex:none;padding:8px 12px;color:var(--accent-strong);font-size:.8125rem}.copy-button:hover{border-color:var(--accent);background:var(--accent-muted)}.reference-entry p{margin:8px 0 0;color:var(--text-muted);font-size:.875rem;line-height:1.5}.empty-state{margin:0;padding:24px 0;color:var(--text-muted)}
.search-label input:focus-visible,.section-nav button:focus-visible,.copy-button:focus-visible{border-color:var(--accent);outline:2px solid var(--accent);outline-offset:2px}
.sr-status{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (max-width:47.999rem){.reference-controls{padding-inline:16px}.reference-panel{padding-inline:16px}.notice,.result-summary{padding-inline:16px}.section-nav{grid-template-columns:repeat(2,minmax(0,1fr))}.entry-command{align-items:stretch;flex-direction:column}.copy-button{width:100%}}
@media (max-width:34.999rem){.section-nav{grid-template-columns:1fr}.reference-entry{padding:10px}}
@media (prefers-reduced-motion:reduce){.reference-shell *{scroll-behavior:auto}}
</style>
