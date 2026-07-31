# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
