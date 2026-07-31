import type { ToolDefinition } from './types'

export const toolRegistry = [
  {
    id: 'soc-tools.base64',
    nameKey: 'tools.base64.name',
    descriptionKey: 'tools.base64.description',
    category: 'encoding',
    routePath: '/tools/base64',
    component: () => import('./base64/Base64Tool.vue'),
    recommendedMaxInputBytes: 1_000_000,
    icon: {
      viewBox: '0 0 24 24',
      paths: ['M8 4 3 12l5 8', 'm16 4 5 8-5 8', 'm14 3-4 18'],
    },
  },
  {
    id: 'soc-tools.hex', nameKey: 'tools.hex.name', descriptionKey: 'tools.hex.description',
    category: 'encoding', routePath: '/tools/hex', component: () => import('./hex/HexTool.vue'),
    recommendedMaxInputBytes: 1_000_000,
    icon: { viewBox: '0 0 24 24', paths: ['M7 3 4 21', 'M17 3l-3 18', 'M3 9h18', 'M2 15h18'] },
  },
  {
    id: 'soc-tools.url', nameKey: 'tools.url.name', descriptionKey: 'tools.url.description',
    category: 'encoding', routePath: '/tools/url', component: () => import('./url/UrlTool.vue'),
    recommendedMaxInputBytes: 1_000_000,
    icon: { viewBox: '0 0 24 24', paths: ['M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1', 'M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1'] },
  },
  {
    id: 'soc-tools.jwt', nameKey: 'tools.jwt.name', descriptionKey: 'tools.jwt.description',
    category: 'inspection', routePath: '/tools/jwt', component: () => import('./jwt/JwtTool.vue'),
    recommendedMaxInputBytes: 256_000,
    icon: { viewBox: '0 0 24 24', paths: ['M12 3v4', 'm12 17v4', 'M3 12h4', 'm17 0h4', 'm5.6 5.6 2.8 2.8', 'm7.6 16.4-2.8 2.8', 'm16.4 16.4 2.8 2.8', 'm16.4 7.6 2.8-2.8'] },
  },
  {
    id: 'soc-tools.psdecoder', nameKey: 'tools.psdecoder.name', descriptionKey: 'tools.psdecoder.description',
    category: 'inspection', routePath: '/tools/powershell-decoder', component: () => import('./psdecoder/PsDecoderTool.vue'),
    recommendedMaxInputBytes: 256_000,
    icon: { viewBox: '0 0 24 24', paths: ['M4 5h16v14H4z', 'm7 9 3 3-3 3', 'M12 15h5'] },
  },
  {
    id: 'soc-tools.deobfuscator', nameKey: 'tools.deobfuscator.name', descriptionKey: 'tools.deobfuscator.description',
    category: 'deobfuscation', routePath: '/tools/deobfuscator', component: () => import('./deobfuscator/DeobfuscatorTool.vue'),
    recommendedMaxInputBytes: 256_000,
    icon: { viewBox: '0 0 24 24', paths: ['M5 4h14v16H5z', 'm8 9 3 3-3 3', 'M13 15h3', 'M8 4V2', 'M16 4V2'] },
  },
  {
    id: 'soc-tools.hash', nameKey: 'tools.hash.name', descriptionKey: 'tools.hash.description',
    category: 'hashing', routePath: '/tools/hash', component: () => import('./hash/HashTool.vue'),
    recommendedMaxInputBytes: 5_000_000,
    icon: { viewBox: '0 0 24 24', paths: ['M7 3 4 21', 'M17 3l-3 18', 'M3 9h18', 'M2 15h18', 'm10 7 4 2-4 2z'] },
  },
  {
    id: 'soc-tools.defang', nameKey: 'tools.defang.name', descriptionKey: 'tools.defang.description',
    category: 'threat-intel', routePath: '/tools/defang', component: () => import('./defang/DefangTool.vue'),
    recommendedMaxInputBytes: 1_000_000,
    icon: { viewBox: '0 0 24 24', paths: ['M12 3 4 6v5c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6z', 'm8 12 2.5 2.5L16 9'] },
  },
  {
    id: 'soc-tools.ioc', nameKey: 'tools.ioc.name', descriptionKey: 'tools.ioc.description',
    category: 'threat-intel', routePath: '/tools/ioc', component: () => import('./ioc/IocTool.vue'),
    recommendedMaxInputBytes: 1_000_000,
    icon: { viewBox: '0 0 24 24', paths: ['M12 3v3', 'M12 18v3', 'M3 12h3', 'M18 12h3', 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'] },
  },
  {
    id: 'soc-tools.timestamp', nameKey: 'tools.timestamp.name', descriptionKey: 'tools.timestamp.description',
    category: 'time', routePath: '/tools/timestamp', component: () => import('./timestamp/TimestampTool.vue'),
    recommendedMaxInputBytes: 4_000,
    icon: { viewBox: '0 0 24 24', paths: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18', 'M12 7v5l3 2'] },
  },
  {
    id: 'soc-tools.netlogs', nameKey: 'tools.netlogs.name', descriptionKey: 'tools.netlogs.description',
    category: 'network', routePath: '/tools/network-logs', component: () => import('./netlogs/NetLogsTool.vue'),
    recommendedMaxInputBytes: 5_000_000,
    icon: { viewBox: '0 0 24 24', paths: ['M5 6a2 2 0 1 0 0 .01', 'M19 6a2 2 0 1 0 0 .01', 'M12 18a2 2 0 1 0 0 .01', 'M7 6h10', 'm6.5 8.2 4-6.4', 'm10.5 6.4 4 6.4'] },
  },
  {
    id: 'soc-tools.strings', nameKey: 'tools.strings.name', descriptionKey: 'tools.strings.description',
    category: 'dfir', routePath: '/tools/strings', component: () => import('./strings/StringsTool.vue'),
    recommendedMaxInputBytes: 10_000_000,
    icon: { viewBox: '0 0 24 24', paths: ['M4 6h10', 'M4 11h7', 'M4 16h6', 'M17 15a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'm20 14 2 2'] },
  },
  {
    id: 'soc-tools.eventxml', nameKey: 'tools.eventxml.name', descriptionKey: 'tools.eventxml.description',
    category: 'windows', routePath: '/tools/windows-event', component: () => import('./eventxml/EventXmlTool.vue'),
    recommendedMaxInputBytes: 1_000_000,
    icon: { viewBox: '0 0 24 24', paths: ['M6 3h9l4 4v14H6z', 'M15 3v5h4', 'M9 12h7', 'M9 16h7'] },
  },
  {
    id: 'soc-tools.cmdline', nameKey: 'tools.cmdline.name', descriptionKey: 'tools.cmdline.description',
    category: 'windows', routePath: '/tools/windows-cmdline', component: () => import('./cmdline/CmdLineTool.vue'),
    recommendedMaxInputBytes: 256_000,
    icon: { viewBox: '0 0 24 24', paths: ['M4 5h16v14H4z', 'm7 9 3 3-3 3', 'M12 15h5', 'M4 8h16'] },
  },
  {
    id: 'soc-tools.winartifacts', nameKey: 'tools.winartifacts.name', descriptionKey: 'tools.winartifacts.description',
    category: 'windows', routePath: '/tools/windows-artifacts', component: () => import('./winartifacts/WinArtifactsTool.vue'),
    recommendedMaxInputBytes: 8_192,
    icon: { viewBox: '0 0 24 24', paths: ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h6v6h-6z', 'M10 7h4', 'M7 10v4', 'M17 10v4', 'M10 17h4'] },
  },
] as const satisfies readonly ToolDefinition[]

export function getTool(id: ToolDefinition['id']): ToolDefinition {
  const tool = toolRegistry.find((candidate) => candidate.id === id)
  if (!tool) throw new Error(`Unknown tool: ${id}`)
  return tool
}
