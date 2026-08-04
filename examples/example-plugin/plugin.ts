import { definePlugin, PLUGIN_API_VERSION } from '../../src/plugins/types'

export default definePlugin({
  id: 'example.plugin', name: 'Example Plugin', version: '1.0.0', license: 'MIT',
  pluginApiVersion: PLUGIN_API_VERSION, minCoreVersion: '1.7.1',
  provides: {
    tools: [{ id: 'example.echo', nameKey: 'tools.echo.name', descriptionKey: 'tools.echo.description', category: 'encoding', routePath: '/tools/echo', component: () => import('./ExampleTool.vue'), recommendedMaxInputBytes: 65_536 }],
    themes: [{
      id: 'example-ember', nameKey: 'themes.exampleEmber', tokens: {
        dark: {
          'surface-base': '#160C0A', 'surface-raised': '#24120E', 'surface-overlay': '#351B14', 'border-hairline': '#63352A', 'border-strong': '#A65B43', 'text-primary': '#FFF5F0', 'text-secondary': '#E8C7B9', 'text-muted': '#C69A88', accent: '#FF9566', 'accent-strong': '#FFB08C', 'accent-muted': '#63301F', warn: '#E8B75B', danger: '#FF7C70', 'io-well': '#100806', 'io-panel': '#1D0E0B', 'io-strip': '#2A1510', 'io-border': '#A65B43', 'terminal-editor-text': '#FFF5F0', 'terminal-editor-placeholder': '#C69A88',
        },
        light: {
          'surface-base': '#FFF5F0', 'surface-raised': '#FFFBF9', 'surface-overlay': '#F5E5DD', 'border-hairline': '#D9B7A8', 'border-strong': '#A66F5C', 'text-primary': '#2A130D', 'text-secondary': '#61392B', 'text-muted': '#805D4D', accent: '#B84925', 'accent-strong': '#8F3518', 'accent-muted': '#F5D6C8', warn: '#795500', danger: '#A92F2A', 'io-well': '#F5E5DD', 'io-panel': '#FFFBF9', 'io-strip': '#ECD5CA', 'io-border': '#A66F5C', 'terminal-editor-text': '#FFF5F0', 'terminal-editor-placeholder': '#C69A88',
        },
      },
    }],
  },
  messages: {
    en: { categories: { encoding: 'Encoding' }, tools: { echo: { name: 'Echo', description: 'Echo input.' } }, themes: { exampleEmber: 'Example Ember' } },
    nl: { categories: { encoding: 'Codering' }, tools: { echo: { name: 'Echo', description: 'Herhaal invoer.' } }, themes: { exampleEmber: 'Voorbeeld Ember' } },
  },
})
