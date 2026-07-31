import type { Component } from 'vue'

export interface ToolIcon {
  viewBox: string
  paths: readonly string[]
}

export interface ToolDefinition {
  id: `${string}.${string}`
  nameKey: string
  descriptionKey: string
  category: string
  routePath: `/${string}`
  component: () => Promise<{ default: Component }>
  recommendedMaxInputBytes: number
  icon?: ToolIcon
}
