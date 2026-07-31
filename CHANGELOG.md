# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Six new tools: Hex, URL encode/decode, JWT inspection (no signature verification), Hash (MD5 + SHA-1/256/384/512 via Web Crypto, labelled where non-cryptographic), Defang/refang IOCs, and a Timestamp converter (Unix, Windows FILETIME, human date-times in UTC and Europe/Amsterdam) — each with test vectors.
- Modular theme system with four built-in themes (Terminal, Slate, Frost, High contrast), each with dark and light modes, switchable from the top bar and designed so future plugins can register their own.
- Inline-SVG tool icons, a console-style home landing, and a terminal-style input/output surface for tools.
- Strict production Content-Security-Policy (no `unsafe-eval`/`unsafe-inline`) and security headers, shipped as `public/_headers` and a matching nginx snippet.
- GitHub Actions CI (typecheck, lint, tests, `npm audit`, build) with least-privilege permissions and commit-pinned actions, plus a Dependabot config.
- A no-network test proving the tools make no network calls, and a Content-Security-Policy smoke test against the production build.

### Changed

- Redesigned the app shell into a two-pane analyst-console layout and replaced the theme control with a clear light/dark (sun/moon) toggle that follows the system preference by default.
- Enforced each tool's recommended input-size limit (previously only a warning) with debounced processing, and moved hashing into a cancellable Web Worker so large inputs cannot freeze the tab.

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
