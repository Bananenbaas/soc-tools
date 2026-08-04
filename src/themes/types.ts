export const themeTokenNames = [
  'surface-base',
  'surface-raised',
  'surface-overlay',
  'border-hairline',
  'border-strong',
  'text-primary',
  'text-secondary',
  'text-muted',
  'accent',
  'accent-strong',
  'accent-muted',
  'warn',
  'danger',
  'io-well',
  'io-panel',
  'io-strip',
  'io-border',
  'terminal-editor-text',
  'terminal-editor-placeholder',
] as const

export type ThemeTokenName = (typeof themeTokenNames)[number]
export type ThemeTokens = Readonly<Record<ThemeTokenName, `#${string}`>>

export interface ThemeDefinition {
  id: string
  nameKey: string
  tokens: {
    dark: ThemeTokens
    light: ThemeTokens
  }
}
