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
    icon: {
      viewBox: '0 0 24 24',
      paths: ['M8 4 3 12l5 8', 'm16 4 5 8-5 8', 'm14 3-4 18'],
    },
  },
] as const satisfies readonly ToolDefinition[]

export function getTool(id: ToolDefinition['id']): ToolDefinition {
  const tool = toolRegistry.find((candidate) => candidate.id === id)
  if (!tool) throw new Error(`Unknown tool: ${id}`)
  return tool
}
