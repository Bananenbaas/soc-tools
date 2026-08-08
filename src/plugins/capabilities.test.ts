import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { enabledPlugins } from './index'
import {
  assertCapabilityCspContract,
  capabilityCspRequirements,
  requiredCapabilityCspTokensByDirective,
  shippedEvalLikeCspTokensByDirective,
} from './capabilities'

describe('plugin capability CSP contract', () => {
  it('matches the eval-like tokens in every shipped CSP policy', async () => {
    const policies = await Promise.all([
      readFile(resolve(process.cwd(), 'public/_headers'), 'utf8'),
      readFile(resolve(process.cwd(), 'deploy/nginx-headers.conf'), 'utf8'),
    ])

    for (const policy of policies) assertCapabilityCspContract(policy, enabledPlugins)
    expect(shippedEvalLikeCspTokensByDirective(policies[0]).get('script-src')).toEqual(new Set(["'wasm-unsafe-eval'"]))
    expect(requiredCapabilityCspTokensByDirective(enabledPlugins).get('script-src')).toEqual(new Set(["'wasm-unsafe-eval'"]))
    expect(capabilityCspRequirements.wasm.token).toBe("'wasm-unsafe-eval'")
  })

  it('maps every declared capability to its directive and ignores unknown keys safely', () => {
    for (const [capability, requirement] of Object.entries(capabilityCspRequirements)) {
      const plugin = { capabilities: [capability] } as never
      expect(requiredCapabilityCspTokensByDirective([plugin]).get(requirement.directive)).toEqual(new Set([requirement.token]))
    }
    expect(() => requiredCapabilityCspTokensByDirective([{ capabilities: ['future.capability'] } as never])).not.toThrow()
    expect(() => assertCapabilityCspContract('default-src \'none\'', [{ capabilities: ['future.capability'] } as never])).not.toThrow()
  })

  it('rejects an eval-like token in the wrong directive', () => {
    expect(() => assertCapabilityCspContract("script-src 'self' 'wasm-unsafe-eval'; style-src 'unsafe-eval'", enabledPlugins)).toThrow(/style-src.*unjustified/u)
  })
})
