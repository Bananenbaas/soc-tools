import { defineAsyncComponent, defineComponent, h } from 'vue'
import type { ToolDefinition } from '../tools/types'
import ToolErrorBoundary from './ToolErrorBoundary.vue'

export function createToolRouteComponent(tool: ToolDefinition) {
  // Lazy loaders fail into ToolErrorBoundary; a failed loader is not retried because
  // retrying cannot make a deterministic local module import succeed.
  const ToolComponent = defineAsyncComponent({
    loader: tool.component,
    delay: 0,
    loadingComponent: defineComponent({
      name: 'ToolLoadingFallback',
      setup: () => () => h('div', { role: 'status' }, 'Loading tool…'),
    }),
    onError: (_error, _retry, fail) => fail(),
  })
  return defineComponent({
    name: `ToolRoute-${tool.id}`,
    setup: () => () => h(ToolErrorBoundary, null, { default: () => h(ToolComponent) }),
  })
}
