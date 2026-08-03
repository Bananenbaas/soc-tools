# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
