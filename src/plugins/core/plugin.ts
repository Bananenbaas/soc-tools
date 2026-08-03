import { coreThemeDefinitions } from '../../themes/definitions'
import { coreToolDefinitions } from '../../tools/definitions'
import { definePlugin, PLUGIN_API_VERSION } from '../types'
import { corePluginMessages } from './messages'

export default definePlugin({
  id: 'soc-tools.core',
  name: 'SOC-Tools Core',
  version: '1.5.0',
  license: 'MIT',
  pluginApiVersion: PLUGIN_API_VERSION,
  minCoreVersion: '1.5.0',
  provides: {
    tools: coreToolDefinitions,
    themes: coreThemeDefinitions,
  },
  messages: corePluginMessages,
  capabilities: ['wasm'],
})
