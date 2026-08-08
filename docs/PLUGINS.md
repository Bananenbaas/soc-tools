# Plugin authoring

Plugins are local TypeScript modules discovered at build time. A plugin is a default export created with `definePlugin` from `src/plugins/types.ts`.

## Manifest

`PluginManifest` contains:

- `id`: a stable plugin identifier.
- `name` and `version`: the display name and strict semver version.
- `license`: a non-empty SPDX license identifier.
- `pluginApiVersion`: the exported `PLUGIN_API_VERSION` value.
- `minCoreVersion` and optional `maxCoreVersion`: strict semver bounds for the SOC-Tools core version.
- `provides.tools` and `provides.themes`: arrays of tool and theme definitions.
- `messages.en` and `messages.nl`: the complete English and Dutch message trees used by the plugin.
- `capabilities`: optional declared capabilities. The current capability is `wasm`.

Tools use a two-part lowercase ID such as `example.decoder`, a route beginning with `/`, a lazy Vue component, a category, message keys, and a positive recommended input size. Icons contain a non-empty `viewBox` and one or more non-empty SVG path strings. Themes must provide every theme token for both `dark` and `light` modes.

## Providing a theme

A plugin can provide a theme alongside its tools. A `ThemeDefinition` has a stable `id`, a translation `nameKey`, and complete `tokens.dark` and `tokens.light` records. Every record must include `surface-base`, `surface-raised`, `surface-overlay`, `border-hairline`, `border-strong`, `text-primary`, `text-secondary`, `text-muted`, `accent`, `accent-strong`, `accent-muted`, `warn`, `danger`, `io-well`, `io-panel`, `io-strip`, and `io-border`; each value is a hex color.

Theme CSS is generated during the build from the registered `ThemeDefinition` records. The generated self-hosted stylesheet contains dark, explicit light, and system-preferred-light selectors for every theme. Do not add theme selectors or color values to `src/styles.css`; the definition is the source of truth.

See [`examples/example-plugin/plugin.ts`](../examples/example-plugin/plugin.ts) for a small manifest providing both a tool and a theme. The example is documentation only and is outside `src/plugins/`, so it is not discovered or shipped.

Use `PLUGIN_API_VERSION` rather than copying its number:

```ts
import { definePlugin, PLUGIN_API_VERSION } from '../types'

export default definePlugin({
  id: 'example.plugin',
  name: 'Example Plugin',
  version: '1.0.0',
  license: 'MIT',
  pluginApiVersion: PLUGIN_API_VERSION,
  minCoreVersion: '1.5.0',
  provides: { tools: [], themes: [] },
  messages: { en: {}, nl: {} },
})
```

## Discovery and configuration

Create `src/plugins/<name>/plugin.ts` with the manifest as its default export. Vite discovers these modules eagerly at build time. The core plugin is loaded first; tool IDs and routes must be unique across all plugins.

`soc-tools.config.ts` can limit the resulting tool registry with `disabledTools` or `enabledTools`. Unknown IDs and invalid configuration stop the build. An enabled (active) plugin contributes each selected tool. It also contributes its themes and messages when it has at least one selected tool, or when it provides at least one theme. This keeps theme-only plugins usable while preventing a third-party plugin whose tools are all disabled and which has no themes from leaking messages. The core plugin has enabled tools by default, so its themes and messages always remain available. Licenses and capabilities use this same active-plugin set.

## Validation and CSP

The build validates manifest shape, semver and core-version compatibility, API compatibility, licenses, tool IDs and routes, tool fields, icons, theme tokens, English/Dutch messages, duplicate IDs and routes, and forbidden message keys (`__proto__`, `constructor`, and `prototype`).

Capabilities are declarations, not CSP generators. Each capability must have an entry in `src/plugins/capabilities.ts`. The shipped CSP is checked per directive against the capabilities of active plugins: every required token must be present in its declared directive, and no additional eval-like token is permitted in any directive. Unknown capability names are ignored by the guard after manifest validation has reported them.

## Constraints

Plugins run client-side only. They must not use network access, `eval`, dynamic code execution, external assets, or new dependencies. Keep user-facing strings in both English and Dutch message trees. Do not change existing tool IDs or routes. The application is designed for local processing and does not provide authorization to handle sensitive data.

The per-route error boundary covers tool render/setup failures and rejected lazy imports. Errors from a tool's own event handlers, timers, or workers are outside that boundary and remain the tool author's responsibility.
