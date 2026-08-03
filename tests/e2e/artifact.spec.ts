import { readFile } from 'node:fs/promises'
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
