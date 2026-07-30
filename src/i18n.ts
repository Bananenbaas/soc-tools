import { createI18n } from 'vue-i18n'

const messages = {
  en: {
    app: {
      skip: 'Skip to main content',
      github: 'View SOC-Tools on GitHub',
      theme: 'Switch to {theme} theme',
      light: 'light',
      dark: 'dark',
      smallerText: 'Decrease text size',
      largerText: 'Increase text size',
      language: 'Language',
      controls: 'Application controls',
      tools: 'Tools',
      footer: 'Use responsibly. Do not process sensitive or classified data without authorization.',
    },
    home: {
      title: 'Tools for SOC analysts',
      intro: 'Focused utilities that process data locally in your browser.',
      openTool: 'Open {name}',
    },
    categories: { encoding: 'Encoding' },
    tools: {
      base64: {
        name: 'Base64 encode/decode',
        description: 'Convert UTF-8 text to Base64 or Base64URL and back.',
        input: 'Input',
        output: 'Output',
        mode: 'Operation',
        encode: 'Encode',
        decode: 'Decode',
        variant: 'Format',
        standard: 'Base64',
        url: 'Base64URL',
        clear: 'Clear input and output',
        copy: 'Copy output',
        copied: 'Copied',
        warning: 'This input is larger than the recommended limit of {size}. Your browser may respond slowly.',
        invalid: 'This is not valid {variant} input. Check its characters and padding.',
        inputPlaceholder: 'Enter text to transform',
        outputPlaceholder: 'The result appears here',
      },
    },
  },
  nl: {
    app: {
      skip: 'Ga naar hoofdinhoud',
      github: 'Bekijk SOC-Tools op GitHub',
      theme: 'Schakel over naar het {theme} thema',
      light: 'lichte',
      dark: 'donkere',
      smallerText: 'Tekst verkleinen',
      largerText: 'Tekst vergroten',
      language: 'Taal',
      controls: 'Applicatiebediening',
      tools: 'Tools',
      footer: 'Gebruik verantwoord. Verwerk geen gevoelige of gerubriceerde gegevens zonder toestemming.',
    },
    home: {
      title: 'Tools voor SOC-analisten',
      intro: 'Gerichte hulpmiddelen die gegevens lokaal in je browser verwerken.',
      openTool: 'Open {name}',
    },
    categories: { encoding: 'Codering' },
    tools: {
      base64: {
        name: 'Base64 coderen/decoderen',
        description: 'Zet UTF-8-tekst om naar Base64 of Base64URL en terug.',
        input: 'Invoer',
        output: 'Uitvoer',
        mode: 'Bewerking',
        encode: 'Coderen',
        decode: 'Decoderen',
        variant: 'Formaat',
        standard: 'Base64',
        url: 'Base64URL',
        clear: 'Wis invoer en uitvoer',
        copy: 'Kopieer uitvoer',
        copied: 'Gekopieerd',
        warning: 'Deze invoer is groter dan de aanbevolen limiet van {size}. Je browser kan traag reageren.',
        invalid: 'Dit is geen geldige {variant}-invoer. Controleer de tekens en opvulling.',
        inputPlaceholder: 'Voer tekst in om te verwerken',
        outputPlaceholder: 'Het resultaat verschijnt hier',
      },
    },
  },
} as const

const savedLocale = localStorage.getItem('soc-tools-locale')

export const i18n = createI18n({
  legacy: false,
  locale: savedLocale === 'nl' ? 'nl' : 'en',
  fallbackLocale: 'en',
  messages,
})
