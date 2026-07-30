# SOC-Tools

SOC-Tools is an open-source collection of focused utilities for security operations center analysts. The project is in its MVP phase; its first tool encodes and decodes UTF-8 text using Base64 or Base64URL.

Tools are designed to run in the browser and the current Base64 tool does not send its input over the network. Browser extensions, hosting infrastructure, or future integrations may affect that boundary, so review the deployment and source before handling data.

Repository: [github.com/Bananenbaas/soc-tools](https://github.com/Bananenbaas/soc-tools)

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

## Self-hosting

Self-hosting documentation will be added as the MVP deployment model is finalized. For now, `npm run build` produces static assets in `dist/`; configure your web server to fall back to `index.html` for client-side routes and provide an appropriate Content Security Policy.

The small inline theme bootstrap in `index.html` prevents a light/dark flash before Vue starts. A strict CSP can allow only that script with a matching hash; Vue templates are compiled during the build and require neither `unsafe-eval` nor runtime template compilation.

## Security

SOC-Tools is a security tool, so its own boundaries are stated explicitly. See
[THREAT_MODEL.md](THREAT_MODEL.md) for what the project defends against, what it
deliberately does not, and why "client-side" is a genuine but non-absolute claim.

## Disclaimer

Do not enter sensitive or classified data unless you are authorized to process it in the browser and have reviewed your environment. SOC-Tools is provided without warranty; validate results before using them in operational decisions.

## License

[MIT](LICENSE)
