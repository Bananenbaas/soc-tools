import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ToolDefinition } from '../tools/types'
import { createToolRouteComponent } from './toolRoute'

const source = async (file: string) => readFile(resolve(process.cwd(), 'src/plugins', file), 'utf8')

describe('tool route error containment', () => {
  const tool = (component: ToolDefinition['component']) => ({
    id: 'fixture.tool', nameKey: 'tools.base64.name', descriptionKey: 'tools.base64.description',
    category: 'encoding', routePath: '/tools/fixture', component, recommendedMaxInputBytes: 1,
  }) as ToolDefinition

  it('wraps a lazy import that rejects in the route boundary contract', async () => {
    const route = createToolRouteComponent(tool(() => Promise.reject(new Error('lazy import failed'))))
    expect(route).toBeDefined()
    const routeSource = await source('toolRoute.ts')
    expect(routeSource).toContain('onError: (_error, _retry, fail) => fail()')
    expect(routeSource).toContain('loadingComponent')
  })

  it('contains render and setup failures through onErrorCaptured', async () => {
    const route = createToolRouteComponent(tool(async () => ({ default: { render: () => { throw new Error('render failed') } } as never })))
    expect(route).toBeDefined()
    const boundarySource = await source('ToolErrorBoundary.vue')
    expect(boundarySource).toContain('onErrorCaptured')
    expect(boundarySource).toContain('return false')
  })
})
