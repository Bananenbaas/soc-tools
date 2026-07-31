# SOC-Tools

[![CI](https://github.com/Bananenbaas/soc-tools/actions/workflows/ci.yml/badge.svg)](https://github.com/Bananenbaas/soc-tools/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/github/license/Bananenbaas/soc-tools)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/Bananenbaas/soc-tools)](https://github.com/Bananenbaas/soc-tools/releases)
[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare%20Pages-live-F38020?logo=cloudflare&logoColor=white)](https://soc-tools.pages.dev)

SOC-Tools is an open-source collection of focused, client-side utilities for security operations center analysts — encoding/decoding, hashing, IOC extraction, JWT/PowerShell/Windows-event inspection, network-log exploration, and JavaScript deobfuscation.

The tools run entirely in the browser and do not send your input over the network. Browser extensions, hosting infrastructure, or future integrations may affect that boundary, so review the deployment and source before handling sensitive data.

Live demo: [soc-tools.pages.dev](https://soc-tools.pages.dev)  
Repository: [github.com/Bananenbaas/soc-tools](https://github.com/Bananenbaas/soc-tools)

## Tools

- **Encoding** — Base64, Hex, and URL encode/decode
- **Inspection** — JWT inspect (no signature verification) and a PowerShell EncodedCommand decoder
- **Hashing** — MD5 and SHA-1/256/384/512 digests via the Web Crypto API
- **Threat intelligence** — Defang/refang and an IOC Extractor & Normalizer
- **Time** — Timestamp converter (Unix, Windows FILETIME, UTC and Europe/Amsterdam)
- **Network** — Zeek/Suricata Log Explorer
- **Windows / DFIR** — Windows Event XML Parser and Command-Line Analyzer
- **Deobfuscation** — JavaScript Deobfuscator (static peeling plus an optional, isolated QuickJS-WASM sandbox)

## Development

Requires a current Node.js LTS release and npm.

```sh
npm install
npm run dev
npm run typecheck
npm run test
npm run build
```

Use `npm run lint` for static lint checks and `npm run preview` to inspect a production build locally.

## Deployment / Self-hosting

SOC-Tools is a static single-page application and does not require a server-side
runtime. Run `npm run build` to create the deployable files in `dist/`.

### Docker

The published image includes nginx, the full security-header policy, and the SPA
route fallback. It listens on port 8080:

```sh
docker pull ghcr.io/bananenbaas/soc-tools:latest
docker run --rm -p 8080:8080 ghcr.io/bananenbaas/soc-tools:latest
```

Alternatively, build from the repository and start it with `docker compose up
--build`.

### Cloudflare Pages

Cloudflare Pages is the recommended free static-host option. Its free tier offers
unlimited bandwidth and requests and supports up to 100 custom domains per
project. Set the build command to `npm run build` and the output directory to
`dist`. The included `public/_headers` applies the complete CSP and security
headers, while `public/_redirects` provides SPA routing.

### Netlify

Set the build command to `npm run build` and the publish directory to `dist`.
Netlify reads the included `public/_headers` and `public/_redirects` files. Its
free offering has credit-based pricing; roughly 100 GB/month of bandwidth is a
useful comparison point, but current credit consumption and limits should be
checked before deployment.

### Vercel

Vercel does not read `_headers`. Configure both headers and the SPA rewrite in
`vercel.json`. This ready-to-copy example mirrors the repository policy:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Content-Security-Policy", "value": "default-src 'none'; script-src 'self' 'sha256-+oaPpmEiVxNR8PMqJKkpbmIIpqPo7W+iDc6E6/Q2gT4=' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; worker-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "no-referrer" },
        { "key": "Permissions-Policy", "value": "accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), usb=()" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" }
      ]
    }
  ],
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Use `npm run build` with `dist` as the output directory.

### GitHub Pages

GitHub Pages is free and simple, but it cannot set custom response headers. The
strict CSP and headers such as `frame-ancestors`, HSTS, and X-Frame-Options will
therefore not apply. A weaker `<meta http-equiv>` CSP cannot express
`frame-ancestors`. SPA deep links also require a `404.html` copy workaround.
Use GitHub Pages only when the stronger header posture is not required.

Security headers are only as strong as the host's header support. Cloudflare
Pages, Netlify, and Docker with nginx deliver the full set.

The small inline theme bootstrap in `index.html` prevents a light/dark flash before Vue starts. A strict CSP can allow only that script with a matching hash; Vue templates are compiled during the build and require neither `unsafe-eval` nor runtime template compilation.

## Security

SOC-Tools is a security tool, so its own boundaries are stated explicitly. See
[THREAT_MODEL.md](THREAT_MODEL.md) for what the project defends against, what it
deliberately does not, and why "client-side" is a genuine but non-absolute claim.

### Responsible disclosure

Report source-code vulnerabilities through [SECURITY.md](SECURITY.md) and GitHub
Security Advisories. For issues with a specific deployed instance, use that
site's `/.well-known/security.txt`; self-hosters must fill in that file for their
own domain.

## Disclaimer

Do not enter sensitive or classified data unless you are authorized to process it in the browser and have reviewed your environment. SOC-Tools is provided without warranty; validate results before using them in operational decisions.

## License

[MIT](LICENSE)
