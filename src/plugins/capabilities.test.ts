import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { enabledPlugins } from './index'
import { capabilityCspRequirements, requiredCapabilityCspTokens, shippedEvalLikeCspTokens } from './capabilities'

describe('plugin capability CSP contract', () => {
  it('matches the eval-like tokens in every shipped CSP policy', async () => {
    const required = requiredCapabilityCspTokens(enabledPlugins)
    const policies = await Promise.all([
      readFile(resolve(process.cwd(), 'public/_headers'), 'utf8'),
      readFile(resolve(process.cwd(), 'deploy/nginx-headers.conf'), 'utf8'),
    ])

    for (const policy of policies) expect(shippedEvalLikeCspTokens(policy)).toEqual(required)
    expect(capabilityCspRequirements.wasm.token).toBe("'wasm-unsafe-eval'")
  })
})
