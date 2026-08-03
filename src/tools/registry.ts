import type { ToolDefinition } from './types'
import { toolRegistry } from '../plugins'

export { toolRegistry }

export function getTool(id: ToolDefinition['id']): ToolDefinition {
  const tool = toolRegistry.find((candidate) => candidate.id === id)
  if (!tool) throw new Error(`Unknown tool: ${id}`)
  return tool
}
