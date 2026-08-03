import { defineAsyncComponent, defineComponent, h } from 'vue'
import type { ToolDefinition } from '../tools/types'
import ToolErrorBoundary from './ToolErrorBoundary.vue'

export function createToolRouteComponent(tool: ToolDefinition) {
  const ToolComponent = defineAsyncComponent(tool.component)
  return defineComponent({
    name: `ToolRoute-${tool.id}`,
    setup: () => () => h(ToolErrorBoundary, null, { default: () => h(ToolComponent) }),
  })
}
