# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.8.4] - 2026-08-07

### Security

- Hardened the build-time plugin contract so an invalid or hostile plugin is rejected before it can ship. Plugin validation now checks each tool's declared name/description translation keys resolve in both locales, validates plugin and theme ids (grammar and uniqueness), tool routes (shape, and no collision with reserved app routes), and capabilities (must be known — an unknown capability is a validation error, not a runtime crash); a plugin can no longer overwrite core or another plugin's translation keys, and theme ids are constrained so they cannot inject CSS into the generated stylesheet. Plugin configuration is read with own-property checks only, so an inherited enable/disable list cannot silently take effect.

### Fixed

- Added a build-time i18n coverage test that fails if any translation key a tool uses (including dynamic ones like modes/tactics) is missing in English or Dutch, preventing untranslated keys from reaching the UI. Corrected the plugin authoring guide to the actual theme token contract.

## [1.8.3] - 2026-08-07

### Added

- Evidence Timeline Builder: reconstruct an intrusion timeline from evidence for DFIR triage and the HTB CDSA exam. Paste raw log lines (Unix/ms, Windows FILETIME, ISO-8601, syslog, web-access-log, shell-history timestamps) and they are normalised to UTC and Europe/Amsterdam, sorted, de-duplicated, and shown with per-entry deltas and a total duration; a Notes tab adds manual observations stamped now; a Flags & answers tab tracks exam answers. Entries are tagged with MITRE ATT&CK tactics (filter and group by tactic), carry a host/target, and surface extracted indicators plus a de-duplicated indicator list. Export as CSV, JSON, or Markdown (and flags as CSV/Markdown checklist), and save/load the whole workspace as a local JSON file. Fully client-side; times are best-effort normalised and no verdict is given.

## [1.8.2] - 2026-08-06

### Fixed

- Removed a no-op string replacement in the Email Header Parser's MIME encoded-word decoding (it replaced `iso-8859-1` with itself); charset decoding is unchanged. Resolves a CodeQL `js/identity-replacement` alert.
- Made the build-time `<script>` extraction in the theme-asset generator (used only to hash our own inline bootstrap for the CSP) tolerant of tag casing, attributes, and whitespace. The computed CSP hash is unchanged. Resolves a CodeQL `js/bad-tag-filter` alert (a false positive here, since the script parses only our own controlled `index.html`, but hardened anyway).

## [1.8.1] - 2026-08-06

### Fixed

- The theme and language pickers in the top bar are now readable in the dark themes: their native dropdown option lists used a transparent (white) background under the themes' light text, making the options unreadable. The controls and their option lists now use a solid themed background.
- The I/O editor text (tool input and output) is now readable in every theme's light mode. The Terminal theme still forced light editor text — a leftover from when it kept a dark editor well in light mode — which was unreadable on the now-light editor surface; the editor now simply follows the theme's primary text color in all themes and modes.

## [1.8.0] - 2026-08-04

### Added

- Themes are now fully first-class plugin content, on par with tools: a plugin can provide a complete theme (its light and dark token records), and the theme's CSS is generated from those records at build time and shipped as a normal self-hosted stylesheet — so a plugin theme actually renders without hand-editing the global styles. The plugin authoring guide (`docs/PLUGINS.md`) documents this, and `examples/example-plugin/` illustrates a plugin that provides both a tool and a theme.

### Changed

- The four built-in themes (Terminal, Slate, Frost, High contrast) are now generated from their plugin theme definitions instead of hand-written CSS blocks, with an automated test asserting the generated CSS is byte-for-byte identical to the previous values — so the existing themes are visually unchanged. The Content-Security-Policy is unchanged (the theme-name allowlist in the boot script is derived from the registered themes, with its hash updated accordingly).

## [1.7.1] - 2026-08-04

### Added

- The sidebar tool categories are now collapsible: each category header is a keyboard-accessible disclosure with a chevron, its expanded/collapsed state is remembered across visits, the category containing the active tool stays expanded, and filtering temporarily expands the categories that have matches. This keeps the navigation manageable as the tool set grows.

## [1.7.0] - 2026-08-03

### Added

- Plugin capabilities are now tied to the Content-Security-Policy by a build-time guard: a plugin declares the extra capabilities it needs (currently `wasm` → `wasm-unsafe-eval`), and the build fails if the shipped CSP does not match exactly what the enabled plugins require — no missing directive that would break a capability, and no unjustified eval-like directive. Capabilities are the single source of truth for the CSP's eval-like exceptions.
- An Open-source / Licenses page (`/licenses`, linked from the sidebar) listing each enabled plugin's name, version, and SPDX license, noting that the core is MIT and third-party plugins may differ.
- A plugin authoring guide (`docs/PLUGINS.md`) covering the manifest shape, discovery, the `soc-tools.config.ts` enable/disable, the enforced validation rules, the capability/CSP relationship, and the client-side constraints.

### Security

- The production build no longer bundles Vite's `fetch()`-based module-preload polyfill, and a build-artifact test asserts the built `index.html` contains no module-preload/preload links and that the shipped CSP keeps `connect-src 'none'` — so a future change cannot silently reintroduce a runtime network path.

### Fixed

- The Licenses page shows the current application version for the core plugin instead of a stale hardcoded value.

## [1.6.1] - 2026-08-03

### Fixed

- IOC Extractor now recognises compressed IPv6 addresses that start or end with `::` (e.g. `::1`, `fe80::`) and IPv4-mapped forms (`::ffff:192.0.2.1`), which were previously dropped.
- URL decoder (full mode) preserves userinfo (username/password) and decodes query keys and values independently, so an encoded `%26` inside a value is no longer turned into a query separator and credentials are no longer silently lost.
- SIEM Query Wizard: Sigma and Wazuh output now represent `not_equals` and the AND/OR combinator instead of emitting everything as positive equality (an OR combined with `not_equals` emits a coarser skeleton with an explicit "review required" note). Field names, data sources, and time expressions are validated per dialect and replaced with a clearly-marked placeholder when unsafe, so a crafted identifier can no longer become unintended query syntax when the starting query is pasted into a SIEM.
- Certificate Inspector derives elliptic-curve key sizes from the curve OID (a P-256 key now reports 256 bits, not 252) and rejects out-of-range certificate dates instead of silently normalising them.
- Timestamp converter rejects negative FILETIME values (FILETIME is unsigned); Unix timestamps still accept negatives.

### Security

- The JSON Formatter's validation error no longer echoes an excerpt of the input; it reports only the line, column, and parser reason, so pasted secrets are not reflected back into an error message.

## [1.6.0] - 2026-08-03

### Added

- Build-time plugin architecture. Tools and themes are now provided by plugins that are auto-discovered at build time and validated before the app initializes: a plugin manifest declares its id, version, SPDX license, targeted plugin-API version, the tools/themes it provides, and its own English/Dutch messages. The build fails fast if any plugin is invalid (duplicate id or route, missing translations, incompatible API/core version, malformed shape). The 22 existing tools are shipped as the first-party "core" plugin, so nothing changes for users — routes, ids, and behavior are identical.
- `soc-tools.config.ts` lets a self-hoster enable or disable tools by id without patching the core; a disabled tool disappears from the catalog, navigation, and router with no dead route. Missing config enables everything (fail-safe).
- Per-tool runtime error isolation: an error inside one tool now shows a contained message instead of taking down the whole app.

### Security

- Plugin validation is enforced at startup (not only in tests), so a malformed or incompatible plugin cannot ship silently.
- The plugin message-merge is hardened against prototype pollution: `__proto__`, `constructor`, and `prototype` keys are rejected at every level, merges use null-prototype objects, and required-key checks use own-property lookups so inherited keys cannot satisfy them.

## [1.5.2] - 2026-08-03

### Security

- The JavaScript Deobfuscator's QuickJS sandbox now enforces a fixed resource policy: CPU-time, memory, and stack limits are validated and clamped to safe bounds inside the sandbox and the worker instead of trusting caller-supplied values, and the worker rejects malformed or oversized requests. The normal in-app path is unchanged; this removes a way for other in-bundle code to request unbounded sandbox resources.

## [1.5.1] - 2026-08-03

### Fixed

- Tool form controls (inputs, selects, textareas) were referencing CSS custom properties that were never defined, so their backgrounds and borders were dropped and the fields could be nearly invisible — worst in the Terminal theme. The aliases are now defined against real theme tokens, so every tool's fields render clearly in all four themes and both light and dark modes. Native `<select>` dropdowns are now legible in every theme.
- The Terminal theme no longer keeps a dark editor well in light mode; its light mode now uses light panels like the other themes, so every tool looks right in Terminal light.
- The SIEM Query Wizard now renders its form on normal themed surfaces instead of the dark I/O well (which was unreadable in light mode), with the intent scenarios and SIEM dialects shown as clearly-bordered, selectable tiles, tidier spacing, and a centered working column.

### Added

- The running application version is shown in the sidebar, under the local-processing note.

## [1.5.0] - 2026-08-03

### Changed

- SIEM Query Wizard redesigned into a genuine guided, step-by-step flow: choose an intent scenario, pick one target dialect, build conditions with a live preview, set a time window, and land on a result screen showing the query for the chosen dialect with a quick dialect switcher, Sigma/Wazuh skeletons in an expander, and jump-back "edit" actions. A `Wizard | Snel` toggle keeps a fast one-step scratchpad for pasting an IOC list or a single field/value. Navigation is non-linear (completed steps stay editable), each step validates with an inline reason, absolute time ranges are checked, and the last-used dialect is remembered locally. The query-generation logic is unchanged; honest limitations (grep/Sigma/Wazuh drop parts of the spec; nothing connects or runs) are stated throughout.

## [1.4.0] - 2026-08-01

### Added

- JSON Formatter & Inspector: pretty-print (2/4/tab indent) or minify JSON, validate with a precise line:column error and excerpt, sort keys recursively, format newline-delimited JSON (JSONL/NDJSON) with a record count, flatten to dotted leaf paths for nested-log triage, escape/unescape JSON string values, and see size/depth/key statistics. String values that look like Base64 or a JWT are decoded as an informational preview only — nothing is executed, verified, or classified.
- Certificate (PEM / X.509) Inspector: parse a PEM or Base64 X.509 certificate locally with a self-contained ASN.1/DER reader — subject/issuer distinguished names, validity window (UTC and Europe/Amsterdam, with a factual days-remaining note), serial, signature and public-key algorithms, key usage / extended key usage, Subject Alternative Names, basic constraints, SHA-1/SHA-256 fingerprints, and the OIDs of any extensions left undecoded. It is parse-only and informational: it does not verify the signature, chain, trust, or revocation and never contacts a CA, OCSP responder, or CRL.

## [1.3.0] - 2026-08-01

### Added

- Unicode & Homoglyph Inspector: inspect text character-by-character (code point, Unicode general category, script, ASCII), report the writing scripts present and flag mixed-script runs and common confusables, surface invisible/bidirectional/control characters with their positions, show NFC/NFKC normalization, and independently decode backslash/percent/HTML-entity escapes and Punycode (IDN) hostnames. Factual observations only — no verdict.
- Entropy & Byte Analyzer: measure Shannon entropy (bits/byte and normalized) and per-chunk sliding-window entropy of text or of decoded hex/Base64 bytes, with byte statistics (length, printable ratio, unique/null bytes, most/least common bytes) and plain guidance on what entropy ranges typically mean. Informational only.
- IP & CIDR Helper: calculate IPv4/IPv6 subnet details (network, broadcast, usable host range, netmask/wildcard, counts, compressed/expanded forms), classify an address (private, loopback, link-local, multicast, documentation, reserved, or global unicast), and check whether an address falls inside a CIDR range — all locally, no verdict.

## [1.2.4] - 2026-08-01

### Added

- Email Header Parser: paste a raw email header block and get a phishing-triage view — key fields (with MIME encoded-word decoding), the `Received` hop chain ordered origin→delivery with per-hop delays and timestamps in UTC and Europe/Amsterdam, a reported SPF/DKIM/DMARC/ARC authentication summary, and neutral indicator notes (From vs Return-Path/Reply-To domain, extracted IPs/domains). It is informational only — authentication results are self-reported by the receiving servers and there is no verdict.

## [1.2.3] - 2026-08-01

### Added

- SIEM Query Wizard: assemble observations (fields/operators/values, AND/OR logic, an IOC list, and a time window) and generate safely-quoted starting queries for Splunk SPL, Microsoft Kusto KQL, Elastic KQL, Elastic EQL, Lucene, and grep/regex, plus Sigma (YAML) and Wazuh (XML) detection-rule skeletons. A quick scratchpad path turns a pasted IOC list or field/value into quoted expressions instantly. It never connects to a SIEM — every output is a starting point to adapt.

## [1.2.2] - 2026-07-31

### Added

- Windows Artifact Converters: a set of everyday Windows/AD converters — SID (binary ↔ string), GUID byte-order, FILETIME/AD timestamps, Chrome/WebKit time, Unix seconds/milliseconds, access-mask flag decoding, logon-type lookup, and integrity-level lookup. Time values are shown in UTC and Europe/Amsterdam.

## [1.2.1] - 2026-07-31

### Added

- Strings Extractor: pull readable ASCII and UTF-16 (LE/BE) strings — with byte offsets — out of an uploaded file or pasted hex/base64 bytes, surface any URLs, paths, and other indicators found inside, and export as CSV/JSON. Everything is read locally; nothing is uploaded.

## [1.2.0] - 2026-07-31

### Added

- JavaScript Deobfuscator: peel common obfuscation (base64/hex/unicode escapes, `String.fromCharCode`, string concatenation, the Dean Edwards packer) statically as data, plus an opt-in, isolated QuickJS-WASM sandbox (run in a Web Worker, no host bindings, CPU/memory/stack limited) that reveals JSFuck and dynamically-built payloads by capturing them as text without executing them.

### Security

- The Content-Security-Policy `script-src` now includes `'wasm-unsafe-eval'` — only so the sandbox's WebAssembly VM can be instantiated. `unsafe-eval`/`unsafe-inline` remain absent and `connect-src 'none'` is unchanged; the QuickJS build embeds its WASM, so nothing is fetched at runtime.

## [1.1.0] - 2026-07-31

### Added

- IOC Extractor & Normalizer: extract, validate, deduplicate, and normalize indicators (IPv4/IPv6, domains, URLs, MD5/SHA-1/SHA-256, emails, CVEs, Windows paths and registry keys) from free text, with defang/refang, per-type grouping, source line numbers, and CSV/JSON export. Recognition is kept separate from validation, and nothing is labelled malicious.
- PowerShell EncodedCommand Decoder: recognise `-e`/`-enc`/`-EncodedCommand`, decode the Base64 payload as UTF-16LE, and show the script alongside a hex/bytes view, printable strings, extracted indicators/cmdlets, and a best-effort de-obfuscation view. It decodes only — it never executes anything.
- Windows Event XML Parser: turn pasted Windows Event XML (Event Viewer / Sysmon) or exported JSON into a structured triage summary — key fields highlighted (Event ID, provider, computer, user/SID, process/parent, command line, timestamps in UTC and Europe/Amsterdam) plus a full captured-field table. XML is parsed with the browser's DOMParser (XXE-safe).
- Windows Command-Line Analyzer: break a pasted command line into executable, tokenized arguments, interpreter flags (with explanations), environment variables, indicators, and LOLBin recognition, decoding any inline `-EncodedCommand` — all as informative hints, never a verdict.
- Zeek/Suricata Log Explorer: load pasted Zeek (TSV/JSON) or Suricata EVE JSON, auto-detect the format, summarise unique hosts/domains/JA3 fingerprints and top flows, normalise timestamps to UTC, filter records with a small query grammar, and export the filtered rows as CSV/JSON.

### Fixed

- IOC domain recognition no longer accepts common file extensions (`.exe`, `.dll`, `.sct`, …) as a domain TLD, so file names like `regsvr32.exe` are no longer misread as domains.

## [1.0.0] - 2026-07-31

### Added

- Six new tools: Hex, URL encode/decode, JWT inspection (no signature verification), Hash (MD5 + SHA-1/256/384/512 via Web Crypto, labelled where non-cryptographic), Defang/refang IOCs, and a Timestamp converter (Unix, Windows FILETIME, human date-times in UTC and Europe/Amsterdam) — each with test vectors.
- Modular theme system with four built-in themes (Terminal, Slate, Frost, High contrast), each with dark and light modes, switchable from the top bar and designed so future plugins can register their own.
- Inline-SVG tool icons, a console-style home landing, and a terminal-style input/output surface for tools.
- Strict production Content-Security-Policy (no `unsafe-eval`/`unsafe-inline`) and security headers, shipped as `public/_headers` and a matching nginx snippet.
- GitHub Actions CI (typecheck, lint, tests, `npm audit`, build) with least-privilege permissions and commit-pinned actions, plus a Dependabot config.
- A no-network test proving the tools make no network calls, and a Content-Security-Policy smoke test against the production build.
- Docker self-hosting: a multi-stage image (nginx, non-root, healthcheck) that bakes in the security headers and SPA fallback, published to GHCR as a multi-architecture image (linux/amd64, arm64, arm/v7, arm/v6 — including older Raspberry Pi models), plus a `docker-compose.yml`.
- An SPA deep-link fallback (`public/_redirects`) and a Deployment/Self-hosting guide in the README covering Cloudflare Pages, Netlify, Vercel, GitHub Pages, and Docker.

### Changed

- Redesigned the app shell into a two-pane analyst-console layout and replaced the theme control with a clear light/dark (sun/moon) toggle that follows the system preference by default.
- Enforced each tool's recommended input-size limit (previously only a warning) with debounced processing, and moved hashing into a cancellable Web Worker so large inputs cannot freeze the tab.
- Moved the build toolchain to Node 24 (LTS) and updated dependencies: Vite 8, Vue Router 5, Vitest 4, vue-i18n, and `@types/node`.

### Security

- Resolved the development-only dependency advisory in the ESLint toolchain; `npm audit` now reports no vulnerabilities.

## [0.1.0] - 2026-07-30

### Added

- Responsive Vue application shell with accessible theme, text-size, and language controls.
- Shared tool registry used to derive navigation and routes.
- Client-side Base64 and Base64URL encode/decode reference tool.
- English and Dutch interface translations.
- Unit and property-style tests for Base64 conversion.
- Threat model documentation (`THREAT_MODEL.md`).
