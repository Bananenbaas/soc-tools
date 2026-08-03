const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

export type MessageTree = Record<string, unknown>

export function createMessageTree(): MessageTree {
  return Object.create(null) as MessageTree
}

export function mergeMessageTrees(target: MessageTree, source: MessageTree, path = ''): string[] {
  const violations: string[] = []
  for (const key of Object.keys(source)) {
    const keyPath = path ? `${path}.${key}` : key
    if (FORBIDDEN_KEYS.has(key)) {
      violations.push(`Forbidden message key: ${keyPath}`)
      continue
    }
    const value = source[key]
    const existing = Object.prototype.hasOwnProperty.call(target, key) ? target[key] : undefined
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const branch = existing && typeof existing === 'object' && !Array.isArray(existing)
        ? existing as MessageTree
        : createMessageTree()
      violations.push(...mergeMessageTrees(branch, value as MessageTree, keyPath))
      target[key] = branch
    } else {
      target[key] = value
    }
  }
  return violations
}
