import { createI18n } from 'vue-i18n'
import { pluginMessages } from './plugins'

const messages = {
  en: {
    app: {
      skip: 'Skip to main content', github: 'View SOC-Tools on GitHub', themeName: 'Color theme',
      switchTo: { light: 'Switch to light mode', dark: 'Switch to dark mode' },
      smallerText: 'Decrease text size', largerText: 'Increase text size', language: 'Language',
      controls: 'Application controls', tools: 'Tools', searchLabel: 'Filter tools',
      searchPlaceholder: 'Filter tools…', searchToggle: 'Show or hide tool filter',
      drawerToggle: 'Toggle tool navigation', localOnly: 'Processing stays in this browser.',
      footer: 'Use responsibly. Do not process sensitive or classified data without authorization.',
    },
    home: {
      title: 'Tools for SOC analysts', intro: 'Focused utilities that process data locally in your browser.',
      prompt: 'select a tool to begin', trust: 'Runs entirely in your browser', openTool: 'Open {name}',
      resultCount: '{count} tool | {count} tools', noResults: 'No tools match this filter.',
      toolErrorTitle: 'Tool error', toolErrorMessage: 'This tool encountered an error and was safely contained.',
      backHome: 'Back to tools',
    },
    ...pluginMessages.en,
    common: { operation: 'Operation', encode: 'Encode', decode: 'Decode', input: 'Input', output: 'Output', result: 'The result appears here', clear: 'Clear input and output', copy: 'Copy output', copied: 'Copied', inputTooLarge: 'This input exceeds the {size} limit and was not processed.' },
  },
  nl: {
    app: {
      skip: 'Ga naar hoofdinhoud', github: 'Bekijk SOC-Tools op GitHub', themeName: 'Kleurthema',
      switchTo: { light: 'Schakel naar licht', dark: 'Schakel naar donker' },
      smallerText: 'Tekst verkleinen', largerText: 'Tekst vergroten', language: 'Taal',
      controls: 'Applicatiebediening', tools: 'Tools', searchLabel: 'Filter tools',
      searchPlaceholder: 'Filter tools…', searchToggle: 'Toon of verberg het toolfilter',
      drawerToggle: 'Toolnavigatie openen of sluiten', localOnly: 'Verwerking blijft in deze browser.',
      footer: 'Gebruik verantwoord. Verwerk geen gevoelige of gerubriceerde gegevens zonder toestemming.',
    },
    home: {
      title: 'Tools voor SOC-analisten', intro: 'Gerichte hulpmiddelen die gegevens lokaal in je browser verwerken.',
      prompt: 'kies een tool om te beginnen', trust: 'Draait volledig in je browser', openTool: 'Open {name}',
      resultCount: '{count} tool | {count} tools', noResults: 'Geen tools gevonden voor dit filter.',
      toolErrorTitle: 'Toolfout', toolErrorMessage: 'Er is een fout in deze tool veilig opgevangen.',
      backHome: 'Terug naar tools',
    },
    ...pluginMessages.nl,
    common: { operation: 'Bewerking', encode: 'Coderen', decode: 'Decoderen', input: 'Invoer', output: 'Uitvoer', result: 'Het resultaat verschijnt hier', clear: 'Wis invoer en uitvoer', copy: 'Kopieer uitvoer', copied: 'Gekopieerd', inputTooLarge: 'Deze invoer overschrijdt de limiet van {size} en is niet verwerkt.' },
  },
} as const

const savedLocale = localStorage.getItem('soc-tools-locale')

export const i18n = createI18n({
  legacy: false,
  locale: savedLocale === 'nl' ? 'nl' : 'en',
  fallbackLocale: 'en',
  messages,
})
