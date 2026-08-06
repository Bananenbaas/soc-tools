import { createServer } from 'vite'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { cwd } from 'node:process'

const root = cwd()
const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom' })
try {
  const { themeRegistry } = await server.ssrLoadModule('/src/themes/generator-entry.ts')
  const { themeCss } = await server.ssrLoadModule('/src/themes/css.ts')
  const themes = [...themeRegistry]
  const generatedCss = themeCss(themes)
  await mkdir(resolve(root, 'src/generated'), { recursive: true })
  await writeFile(resolve(root, 'src/generated/themes.css'), generatedCss)

  const themeNames = JSON.stringify(themes.map((theme) => theme.id))
  const indexPath = resolve(root, 'index.html')
  const index = await readFile(indexPath, 'utf8')
  const updatedIndex = index
    .replace('__THEME_NAMES__', themeNames)
    .replace(/const a=\[[^\]]*\]/u, `const a=${themeNames}`)
    .replace(/if\((?:\[[^\]]*\]|__THEME_NAMES__)\.includes\(n\|\|""\)\)+/u, `if(${themeNames}.includes(n||""))`)
  if (updatedIndex === index && !index.includes(`${themeNames}.includes(n||""`) && !index.includes('a.includes(n||""')) throw new Error('Theme-name bootstrap placeholder was not found')
  await writeFile(indexPath, updatedIndex)

  const script = updatedIndex.match(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/iu)?.[1]
  if (!script) throw new Error('Theme bootstrap script was not found')
  const hash = createHash('sha256').update(script).digest('base64')
  for (const relativePath of ['public/_headers', 'deploy/nginx-headers.conf']) {
    const path = resolve(root, relativePath)
    const policy = await readFile(path, 'utf8')
    const updatedPolicy = policy.replace(/'sha256-[^']+'/u, `'sha256-${hash}'`)
    if (!policy.match(/'sha256-[^']+'/u)) throw new Error(`CSP hash was not found in ${relativePath}`)
    await writeFile(path, updatedPolicy)
  }
} finally {
  await server.close()
}
