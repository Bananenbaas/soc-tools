import type { ThemeDefinition } from './types'

export const coreThemeDefinitions = [
  {
    id: 'terminal',
    nameKey: 'themes.terminal',
    tokens: {
      dark: {
        'surface-base': '#02050A', 'surface-raised': '#070C13', 'surface-overlay': '#0D1520',
        'border-hairline': '#26364A', 'border-strong': '#49627F', 'text-primary': '#F3F7FC',
        'text-secondary': '#B9C8D9', 'text-muted': '#91A4B9', accent: '#2F9BFF',
        'accent-strong': '#70B9FF', 'accent-muted': '#0B3158', warn: '#E4B04B', danger: '#FF746D',
        'io-well': '#000307', 'io-panel': '#040910', 'io-strip': '#09121D', 'io-border': '#49627F',
      },
      light: {
        'surface-base': '#F1F5F9', 'surface-raised': '#FCFEFF', 'surface-overlay': '#E4EBF2',
        'border-hairline': '#B9C8D7', 'border-strong': '#71869D', 'text-primary': '#0A1520',
        'text-secondary': '#34475A', 'text-muted': '#52677C', accent: '#005CC8',
        'accent-strong': '#00499F', 'accent-muted': '#CFE5FF', warn: '#795500', danger: '#B32929',
        'io-well': '#E4EBF2', 'io-panel': '#FCFEFF', 'io-strip': '#DCE6F0', 'io-border': '#71869D',
      },
    },
  },
  {
    id: 'slate',
    nameKey: 'themes.slate',
    tokens: {
      dark: {
        'surface-base': '#101821', 'surface-raised': '#17212C', 'surface-overlay': '#202D3A',
        'border-hairline': '#314153', 'border-strong': '#4A5D72', 'text-primary': '#EAF0F6',
        'text-secondary': '#B1BFCC', 'text-muted': '#8A9BAB', accent: '#65A5EA',
        'accent-strong': '#75AAE5', 'accent-muted': '#1B3B5D', warn: '#DCAA45', danger: '#FA6B65',
        'io-well': '#0C141D', 'io-panel': '#121C26', 'io-strip': '#1A2733', 'io-border': '#4A5D72',
      },
      light: {
        'surface-base': '#F4F6F8', 'surface-raised': '#FFFFFF', 'surface-overlay': '#E8ECF0',
        'border-hairline': '#CAD2DA', 'border-strong': '#98A6B5', 'text-primary': '#18222C',
        'text-secondary': '#465462', 'text-muted': '#526170', accent: '#1765AD',
        'accent-strong': '#0D518F', 'accent-muted': '#D8E7F4', warn: '#795700', danger: '#B43232',
        'io-well': '#EDF1F4', 'io-panel': '#F7F9FA', 'io-strip': '#E3E8EC', 'io-border': '#98A6B5',
      },
    },
  },
  {
    id: 'frost',
    nameKey: 'themes.frost',
    tokens: {
      dark: {
        'surface-base': '#202B3B', 'surface-raised': '#293648', 'surface-overlay': '#354459',
        'border-hairline': '#465873', 'border-strong': '#657995', 'text-primary': '#EEF3FA',
        'text-secondary': '#C2CDDC', 'text-muted': '#A4B3C7', accent: '#91B8EA',
        'accent-strong': '#B4CFF0', 'accent-muted': '#344F72', warn: '#E0B45B', danger: '#FF918D',
        'io-well': '#1B2635', 'io-panel': '#263244', 'io-strip': '#324156', 'io-border': '#657995',
      },
      light: {
        'surface-base': '#E8EFF7', 'surface-raised': '#F4F8FC', 'surface-overlay': '#DCE6F0',
        'border-hairline': '#B9C8D8', 'border-strong': '#879CB3', 'text-primary': '#233247',
        'text-secondary': '#455A73', 'text-muted': '#4D6077', accent: '#2D6098',
        'accent-strong': '#285581', 'accent-muted': '#CBDDED', warn: '#755300', danger: '#AC3033',
        'io-well': '#E1EAF3', 'io-panel': '#EDF3F9', 'io-strip': '#D5E1ED', 'io-border': '#879CB3',
      },
    },
  },
  {
    id: 'contrast',
    nameKey: 'themes.contrast',
    tokens: {
      dark: {
        'surface-base': '#000000', 'surface-raised': '#050505', 'surface-overlay': '#101010',
        'border-hairline': '#707070', 'border-strong': '#B8B8B8', 'text-primary': '#FFFFFF',
        'text-secondary': '#F0F0F0', 'text-muted': '#D0D0D0', accent: '#008CFF',
        'accent-strong': '#66B8FF', 'accent-muted': '#003A6B', warn: '#FFD166', danger: '#FF8580',
        'io-well': '#000000', 'io-panel': '#000000', 'io-strip': '#0A0A0A', 'io-border': '#FFFFFF',
      },
      light: {
        'surface-base': '#FFFFFF', 'surface-raised': '#FFFFFF', 'surface-overlay': '#F0F0F0',
        'border-hairline': '#555555', 'border-strong': '#111111', 'text-primary': '#000000',
        'text-secondary': '#171717', 'text-muted': '#333333', accent: '#004FC4',
        'accent-strong': '#00388C', 'accent-muted': '#C9DFFF', warn: '#674800', danger: '#9F2025',
        'io-well': '#FFFFFF', 'io-panel': '#FFFFFF', 'io-strip': '#E8E8E8', 'io-border': '#000000',
      },
    },
  },
] as const satisfies readonly ThemeDefinition[]

export const defaultThemeName = 'terminal'
