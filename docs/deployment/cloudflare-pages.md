# Cloudflare Pages

AutoStream docs are built with VitePress and can be published as a static site.

## Settings

| Item | Value |
| --- | --- |
| Production branch | `main` |
| Build command | `npm run docs:build` |
| Build output directory | `docs/.vitepress/dist` |
| Node.js version | `20` or newer |

## Local Check

```powershell
npm install
npm run docs:check
npm run docs:build
```

Do not publish internal scan reports, provider verification record, verification record, runtime logs, screenshots, real credentials, tokens, webhook URLs, or environment-specific paths with the static docs.

## Rollback

If a published docs change exposes secret-like text or an internal procedure, treat it as an incident. Remove the content, rotate any affected credential if needed, rebuild the docs, and redeploy the corrected static output.

