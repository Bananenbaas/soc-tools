import { writeFile } from 'node:fs/promises'

const sourceUrl = 'https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json'
const outputPath = new URL('../src/tools/mitre/attack-catalog.ts', import.meta.url)

const response = await fetch(sourceUrl)
if (!response.ok) throw new Error(`Could not fetch ATT&CK bundle: ${response.status} ${response.statusText}`)
const bundle = await response.json()
const collection = bundle.objects.find((object) => object.type === 'x-mitre-collection' && object.name === 'Enterprise ATT&CK')
const tactics = (phaseName) => phaseName
const catalog = bundle.objects
  .filter((object) => object.type === 'attack-pattern' && !object.revoked && !object.x_mitre_deprecated)
  .map((object) => {
    const reference = object.external_references?.find((item) => item.source_name === 'mitre-attack' && /^T\d{4}(?:\.\d{3})?$/u.test(item.external_id ?? ''))
    if (!reference) return null
    return {
      id: reference.external_id,
      name: object.name,
      tactics: [...new Set((object.kill_chain_phases ?? []).filter((phase) => phase.kill_chain_name === 'mitre-attack').map((phase) => tactics(phase.phase_name)))].sort(),
      url: reference.url,
    }
  })
  .filter(Boolean)
  .sort((a, b) => a.id.localeCompare(b.id, 'en'))

const metadata = { version: collection?.x_mitre_version ?? 'unknown', date: (collection?.modified ?? bundle.objects.find((object) => object.type === 'x-mitre-matrix')?.modified ?? '').slice(0, 10) }
const header = `// Auto-built data — do not edit manually. Rebuild with scripts/generate-mitre-catalog.mjs from the official MITRE ATT&CK Enterprise STIX bundle.\n\nexport interface AttackTechnique {\n  readonly id: string\n  readonly name: string\n  readonly tactics: readonly string[]\n  readonly url: string\n}\n\nexport interface AttackCatalogMetadata {\n  readonly version: string\n  readonly date: string\n}\n\nexport const attackCatalogMetadata: AttackCatalogMetadata = ${JSON.stringify(metadata)} as const\n\nexport const attackCatalog: readonly AttackTechnique[] = `
const content = `${header}${JSON.stringify(catalog)} as const\n`
await writeFile(outputPath, content)
console.log(`Generated ${catalog.length} ATT&CK techniques (${collection?.x_mitre_version ?? 'unknown'}, ${(collection?.modified ?? '').slice(0, 10)})`)
