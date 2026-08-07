# Deploying the student IDE (`apps/web`)

PseudoPilot’s public surface for `1.0.0-beta` is the Next.js app in **`apps/web`**.
No Postgres, Redis, or API service is required.

## Recommended host: Vercel

### One-time project setup

1. Import the GitHub repo into [Vercel](https://vercel.com/new) (or `vercel link` from a clone).
2. **Framework Preset:** Next.js.
3. **Root Directory:** set to **`apps/web`** (uses [`apps/web/vercel.json`](../apps/web/vercel.json)).  
   Alternatively leave Root Directory empty and use the repo-root [`vercel.json`](../vercel.json) — both run the same turbo filter build.
4. **Install / Build** (from `apps/web/vercel.json` when Root Directory is `apps/web`):
   - Install: `cd ../.. && pnpm install --frozen-lockfile`
   - Build: `cd ../.. && pnpm turbo run build --filter=@pseudopilot/web`
5. Confirm Node **22** (matches `.nvmrc`).
6. Deploy. Expected production URL pattern:
   - `https://<project-name>.vercel.app`
   - or a custom domain attached in the Vercel project.

### GitHub Actions deploy (optional)

[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) deploys to Vercel on pushes to `main` when credentials exist.

Add these **repository secrets**:

| Secret | Source |
| --- | --- |
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens |
| `VERCEL_ORG_ID` | `.vercel/project.json` → `orgId` after `vercel link` |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` → `projectId` |

Optionally set repository variable `VERCEL_DEPLOY_ENABLED=true` to enable the Deploy workflow (required; without it the job is skipped).

Until the variable + secrets are present, CI still **gates** a production build via [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (`web-build` job). The Deploy workflow is skipped.

### Local production smoke

```bash
pnpm install
pnpm turbo run build --filter=@pseudopilot/web
pnpm --filter @pseudopilot/web start
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

## Docs assets on the host

In-app documentation screenshots are served by `apps/web/app/api/docs-asset` from the repo `docs/` tree. The Next config includes file-tracing for that path so Vercel serverless bundles include those assets when the monorepo is deployed from the repo root.

## Beta release checklist

1. Green CI on `main` (`check` + `web-build`).
2. Tag `v1.0.0-beta.x` when packaging a named beta (optional GitHub Release notes from `CHANGELOG.md`).
3. Confirm the live URL loads Welcome → example → Run.
4. Keep Cambridge disclaimer and known-limitations copy honest (see `CHANGELOG.md` / Welcome).

## Status

| Item | State |
| --- | --- |
| Local `next build` | Required green before invite |
| CI production build gate | Configured (`web-build` job) |
| Vercel project config | `vercel.json` at repo root |
| Live production URL | **Pending** — create/link Vercel project + secrets (or dashboard Git deploy) |
