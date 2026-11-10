# eearny

A light-theme earnings platform. Monorepo layout:

```
frontend/
  apps/
    auth/        login + register app          → http://localhost:5173
    myaccount/   account dashboard app         → http://localhost:5174
  packages/
    theme/       shared design tokens (theme.css), logo.svg, favicon.svg
backend/
  services/
    auth/        register / login / me         → http://localhost:4001
    account/     profile / summary / txs       → http://localhost:4002
  packages/
    jwt-auth.js  shared JWT sign/verify + express middleware
```

## Colour theme (light, diluted)

4 core colours + accent family, defined in `frontend/packages/theme/theme.css`:

| Token        | Value     | Use                          |
| ------------ | --------- | ---------------------------- |
| `--paper`    | `#F6F5F1` | warm off-white page base     |
| `--surface`  | `#FFFFFF` | cards, inputs                |
| `--ink`      | `#1A1D24` | logo ink — text, primary btn |
| `--line`     | `#E7E4DD` | hairline borders, dividers   |
| `--accent`   | `#6D74C4` | diluted indigo — primary     |
| `--mint`     | `#79B699` | success / paid               |
| `--amber`    | `#DCAB66` | pending / warnings           |
| `--rose`     | `#CE8686` | errors / debits              |

## Brand assets

- **Full logo:** `frontend/packages/theme/assets/logo.svg` (original brandmark, ink glyphs — used as-is on the light theme).
- **Favicon:** `favicon.svg` — the logo's first letter "e" glyph in white on a diluted-indigo rounded square. Copied into each app's `public/`.

## Run everything

```bash
npm install          # root (concurrently)
npm run dev          # both APIs + both frontends
```

Or individually: `npm run dev:auth`, `npm run dev:myaccount`, `npm run dev:auth-api`, `npm run dev:account-api`.

## Deployment (Cloudflare Pages)

Deployed to **https://eearny.pages.dev** (Cloudflare Pages project `eearny`, direct upload):

- `/` — auth app (sign in / register / forgot password)
- `/myaccount/` — myaccount dashboard (built with `BASE_PATH=/myaccount/`)

Rebuild + redeploy:

```bash
# build both apps with production URLs
cd frontend/apps/auth && VITE_MYACCOUNT_URL=https://eearny.pages.dev/myaccount/ npx vite build
cd ../myaccount && BASE_PATH=/myaccount/ VITE_AUTH_URL=https://eearny.pages.dev npx vite build

# merge into one deploy directory
rm -rf /tmp/eearny-site && mkdir -p /tmp/eearny-site/myaccount
cp -r frontend/apps/auth/dist/* /tmp/eearny-site/
cp -r frontend/apps/myaccount/dist/* /tmp/eearny-site/myaccount/

# deploy (needs CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID)
npx wrangler pages deploy /tmp/eearny-site --project-name=eearny --branch=main
```

Note: production builds call the hosted API at https://apieearny.getvoroa.com (auth + account behind one host, set in each app's `.env.production`); local dev still defaults to :4001 / :4002.

## How auth flows

1. Sign in / register in the **auth** app → auth service returns a JWT.
2. Auth app redirects to `http://localhost:5174/?token=…`.
3. **myaccount** captures the token into `localStorage`, cleans the URL, and calls the account service with `Authorization: Bearer …`. Each token is bound to a server-side session (`sid` claim).
4. Both services share `JWT_SECRET` (env var; dev default is built in) and the session store, so revoking a session signs that device out of **both** apps instantly.

## Self-service security (myaccount → Security card)

- **Change password** — verifies the current password; other sessions are signed out.
- **Devices & sessions** — every login is fingerprinted (browser, OS, device type, screen,
  timezone, language, canvas hash) and listed with last-seen time and IP. Revoke any device,
  or "sign out everywhere else".
- **Forgot / reset password** — from the auth app: single-use token, 30-minute expiry,
  revokes all sessions on success (dev mode shows the reset link instead of emailing it).

## Configuration (optional env vars)

- `JWT_SECRET`, `JWT_EXPIRES_IN` — both backend services
- `VITE_AUTH_API_URL`, `VITE_MYACCOUNT_URL` — auth app
- `VITE_ACCOUNT_API_URL`, `VITE_AUTH_URL` — myaccount app

User/account data is stored in JSON files under each service's `data/` (dev only).

### Docker

- `Dockerfile` — **backend**: auth + account services behind one port (`/api/auth/*`, `/api/account/*`, `/health`).
  `docker build -t eearny-backend . && docker run -p 4000:4000 -e JWT_SECRET=<long-random> -v eearny-data:/data eearny-backend`
  (JSON data lives in the `/data` volume — mount it or it is lost on redeploy).
- `Dockerfile.frontend` — builds both frontends and deploys them to Cloudflare Pages
  (`docker run --rm -e CLOUDFLARE_API_TOKEN -e CLOUDFLARE_ACCOUNT_ID eearny-deploy`).
