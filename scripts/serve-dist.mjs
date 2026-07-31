import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, normalize } from 'node:path'

const root = new URL('../dist/', import.meta.url)
const headersFile = await readFile(new URL('../public/_headers', import.meta.url), 'utf8')
const headers = Object.fromEntries(
  headersFile.split('\n').slice(1).filter((line) => line.trim()).map((line) => {
    const [name, ...value] = line.trim().split(':')
    return [name, value.join(':').trim()]
  }),
)
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
}

createServer(async (request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
  const relativePath = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '').replace(/^[/\\]+/, '')
  let file
  let servedPath = relativePath || 'index.html'
  try {
    file = await readFile(new URL(servedPath, root))
  } catch {
    servedPath = 'index.html'
    file = await readFile(new URL('index.html', root))
  }
  response.writeHead(200, {
    ...headers,
    'Content-Type': contentTypes[extname(servedPath)] ?? 'application/octet-stream',
  })
  response.end(file)
}).listen(43999, '127.0.0.1')
