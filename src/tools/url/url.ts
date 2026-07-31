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
    const query = url.search ? decodeURIComponent(url.search.slice(1)) : ''
    return `${url.protocol}//${url.host}${pathname}${query ? `?${query}` : ''}${decodeURIComponent(url.hash)}`
  } catch {
    throw new Error('Invalid URL encoding')
  }
}
