import { themeTokenNames, type ThemeDefinition, type ThemeTokenName } from './types'

const SAFE_THEME_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u

export function themeTokenDeclarations(tokens: ThemeDefinition['tokens']['dark']): string {
  return themeTokenNames.map((name) => `--${name}:${tokens[name]}`).join(';')
}

export function themeCss(themes: readonly ThemeDefinition[]): string {
  const blocks: string[] = []
  for (const theme of themes) {
    if (!SAFE_THEME_ID.test(theme.id)) throw new Error(`Unsafe theme id: ${theme.id}`)
    blocks.push(`:root[data-theme-name="${theme.id}"] { ${themeTokenDeclarations(theme.tokens.dark)} }`)
    blocks.push(`:root[data-theme="light"][data-theme-name="${theme.id}"] { ${themeTokenDeclarations(theme.tokens.light)} }`)
  }
  blocks.push(':root[data-theme="light"] { color-scheme: light }', '', '@media (prefers-color-scheme: light) {')
  for (const theme of themes) blocks.push(`  :root:not([data-theme])[data-theme-name="${theme.id}"] { color-scheme:light;${themeTokenDeclarations(theme.tokens.light)} }`)
  blocks.push('}', '')
  return `${blocks.join('\n')}\n`
}

export function themeTokenNamesAsCss(): readonly ThemeTokenName[] {
  return themeTokenNames
}
