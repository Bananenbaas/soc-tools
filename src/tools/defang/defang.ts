export function defang(value: string): string {
  return value
    .replace(/https/giu, 'hxxps')
    .replace(/http/giu, 'hxxp')
    .replace(/:\/\//gu, '[://]')
    .replace(/@/gu, '[@]')
    .replace(/\.(?!\])/gu, '[.]')
}

export function refang(value: string): string {
  return value
    .replace(/hxxps/giu, 'https')
    .replace(/hxxp/giu, 'http')
    .replace(/\[\s*:\/\/\s*\]/gu, '://')
    .replace(/\[\s*@\s*\]/gu, '@')
    .replace(/\[\s*\.\s*\]/gu, '.')
    .replace(/\(dot\)/giu, '.')
    .replace(/\[dot\]/giu, '.')
}
