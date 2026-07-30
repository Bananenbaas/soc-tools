# Threat Model

This document describes what SOC-Tools defends against, what it deliberately does
*not* defend against, and why. It is intentionally short and honest: a clear
boundary is more useful to an analyst than an exhaustive list that overpromises.

The scope below covers the **MVP** (client-side encoding/decoding and inspection
tools, no backend, no accounts). It is revisited as later phases add capabilities
(deobfuscation, external lookups, plugins) — each of which introduces its own
threats and will extend this document.

## What SOC-Tools is

A static, client-side web application. All tools run in the visitor's browser;
the MVP tools send no input over the network, keep no server-side state, and
require no account. There is no backend to compromise in this phase.

## What we protect

- **The user's input data.** Analysts paste potentially sensitive artefacts
  (encoded payloads, tokens, indicators). That data must not leak off the page:
  not into URLs, browser history, logs, error messages, analytics, or the network.
- **The integrity of the delivered application.** The code the user runs must be
  the code we shipped — not something injected via a compromised dependency,
  a third-party CDN, or a cross-frame attack.

## In scope (MVP)

| Threat | Mitigation |
|---|---|
| **XSS / unsafe output rendering** | No `v-html` on tool input or results; output is always rendered as text. Vue escapes bindings by default. A strict Content Security Policy (see below) is a design target. |
| **Malicious or oversized input** (ReDoS, parser hangs, tab freeze) | Each tool declares a recommended maximum input size and warns the user above it. Parsing avoids catastrophic-backtracking patterns; heavy work moves to Web Workers with timeouts as tools that need it are added. |
| **Data leaking into history / logs / errors** | Tool input is never placed in the URL, never logged, and never sent to analytics. Error messages describe the failure, not the data. |
| **Clickjacking** | `frame-ancestors` in the CSP (with `X-Frame-Options` for older clients) to prevent the app being framed by a hostile site. |
| **Supply-chain compromise of dependencies** | No third-party CDNs for scripts, fonts, icons, or images — everything is bundled. Lockfile committed; dependency advisories tracked; base tooling pinned. |

## Content Security Policy (design target)

The application is built to run under a strict CSP **without** `unsafe-eval` and
`unsafe-inline`. Vue templates are compiled at build time, so no runtime template
compilation or `eval` is required. The one deliberate exception is a tiny inline
theme-bootstrap script in `index.html` (it prevents a light/dark flash before the
app loads); it is small and stable so a hash-based CSP can allow exactly that
script and nothing else. The production CSP is validated against the built app in
CI (added in a later phase).

## Explicitly out of scope

These are stated openly so users can make an informed decision:

- **A compromised browser, browser extension, host, or operating system.** If the
  environment running the browser is hostile, no in-page measure can protect the
  data. This is the most important limitation to understand.
- **Malicious plugins.** The MVP has no plugin system. When an external plugin
  architecture arrives (a later phase), a self-hoster who installs a hostile
  package is trusting that package — the architecture limits runtime injection by
  visitors, not a deliberate choice to add malicious code.
- **Archive / decompression bombs.** The MVP has no archive or decompression
  support, so this class does not apply yet.
- **Stolen API keys / proxy quota exhaustion.** The MVP has no external-lookup
  tools and holds no keys. This becomes relevant only when such tools are added.

## On the "client-side" claim

"Everything runs client-side" is a strong and genuine property, but it is **not a
silver bullet**. It means our servers never receive the data — it does not mean the
data is safe in every situation. A compromised endpoint, a malicious extension, or
shoulder-surfing all sit outside what the application can control. Treat SOC-Tools
as a convenient, transparent processing surface, not as a vault: do not enter
classified or genuinely sensitive data unless you are authorized to process it in
your browser and have reviewed your environment.

## Reporting

A responsible-disclosure contact (`security.txt`) is added alongside the public
deployment. Until then, report suspected vulnerabilities via the repository's
issue tracker or the maintainer contact in the repository profile.
