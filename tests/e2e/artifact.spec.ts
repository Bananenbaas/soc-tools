import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

const projectRoot = process.cwd()

test('production artifact keeps the no-runtime-network invariants', async () => {
  const indexHtml = await readFile(resolve(projectRoot, 'dist/index.html'), 'utf8')
  const headers = await readFile(resolve(projectRoot, 'dist/_headers'), 'utf8')
  const nginxHeaders = await readFile(resolve(projectRoot, 'deploy/nginx-headers.conf'), 'utf8')

  const linkTags = indexHtml.match(/<link\b[^>]*>/giu) ?? []
  expect(linkTags.filter((tag) => /\brel\s*=\s*["'][^"']*\b(?:modulepreload|preload)\b/iu.test(tag))).toEqual([])

  for (const policy of [headers, nginxHeaders]) {
    expect(policy).toMatch(/\bconnect-src\s+'none'(?:\s|;|$)/u)
  }
})

test('all deployment CSP examples use the generated theme bootstrap hash', async () => {
  const indexHtml = await readFile(resolve(projectRoot, 'dist/index.html'), 'utf8')
  const readme = await readFile(resolve(projectRoot, 'README.md'), 'utf8')
  const policies = await Promise.all([
    readFile(resolve(projectRoot, 'public/_headers'), 'utf8'),
    readFile(resolve(projectRoot, 'deploy/nginx-headers.conf'), 'utf8'),
  ])
  const script = indexHtml.match(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/iu)?.[1]
  expect(script).toBeDefined()
  const hash = createHash('sha256').update(script ?? '').digest('base64')
  const cspHash = `'sha256-${hash}'`
  for (const policy of [...policies, readme]) expect(policy).toContain(cspHash)
})
