export type UrlMode = 'component' | 'full'

export function encodeUrl(value: string, mode: UrlMode = 'component'): string {
  if (mode === 'component') return encodeURIComponent(value)
  try {
    const url = new URL(value)
    url.pathname = url.pathname.split('/').map((part) => encodeURIComponent(decodeURIComponent(part))).join('/')
    url.search = Array.from(url.searchParams.entries()).map(([key, item]) => `${encodeURIComponent(key)}=${encodeURIComponent(item)}`).join('&')
    return url.toString()
  } catch {
    throw new Error('Invalid URL')
  }
}

export function decodeUrl(value: string, mode: UrlMode = 'component'): string {
  try {
    if (mode === 'component') return decodeURIComponent(value)
    const url = new URL(value)
    const pathname = decodeURIComponent(url.pathname)
    const query = url.search
      ? url.search.slice(1).split('&').map((part) => {
        const separator = part.indexOf('=')
        const key = separator < 0 ? part : part.slice(0, separator)
        const item = separator < 0 ? undefined : part.slice(separator + 1)
        return `${decodeURIComponent(key)}${item === undefined ? '' : `=${decodeURIComponent(item)}`}`
      }).join('&')
      : ''
    const credentials = url.username || url.password ? `${url.username}${url.password ? `:${url.password}` : ''}@` : ''
    const hash = url.hash ? `#${decodeURIComponent(url.hash.slice(1))}` : ''
    return `${url.protocol}//${credentials}${url.host}${pathname}${url.search ? `?${query}` : ''}${hash}`
  } catch {
    throw new Error('Invalid URL encoding')
  }
}
