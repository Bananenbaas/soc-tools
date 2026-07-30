import type { ToolDefinition } from './types'

export const toolRegistry = [
  {
    id: 'soc-tools.base64',
    nameKey: 'tools.base64.name',
    descriptionKey: 'tools.base64.description',
    category: 'encoding',
    routePath: '/tools/base64',
    component: () => import('./base64/Base64Tool.vue'),
    recommendedMaxInputBytes: 1_000_000,
  },
] as const satisfies readonly ToolDefinition[]

export function getTool(id: ToolDefinition['id']): ToolDefinition {
  const tool = toolRegistry.find((candidate) => candidate.id === id)
  if (!tool) throw new Error(`Unknown tool: ${id}`)
  return tool
}
