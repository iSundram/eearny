# eearny — build both frontends and deploy them to Cloudflare Pages.
#
#   docker build -t eearny-deploy .
#   docker run --rm \
#     -e CLOUDFLARE_API_TOKEN -e CLOUDFLARE_ACCOUNT_ID \
#     eearny-deploy
#
# Credentials are supplied at run time only — never baked into the image.
# Override build-time URLs with --build-arg (e.g. once the backends are public).
FROM node:22-alpine
WORKDIR /app

ARG SITE_URL=https://eearny.pages.dev
ARG VITE_AUTH_API_URL=https://apieearny.getvoroa.com
ARG VITE_ACCOUNT_API_URL=https://apieearny.getvoroa.com
ENV PAGES_PROJECT=eearny PAGES_BRANCH=main

# deps first (cache-friendly)
COPY frontend/apps/auth/package.json frontend/apps/auth/package-lock.json ./frontend/apps/auth/
COPY frontend/apps/myaccount/package.json frontend/apps/myaccount/package-lock.json ./frontend/apps/myaccount/
RUN npm ci --prefix frontend/apps/auth && npm ci --prefix frontend/apps/myaccount \
 && npm install -g wrangler@4

COPY frontend ./frontend

# build + merge (same layout as .github/workflows/frontend.yml)
RUN cd frontend/apps/auth \
      && VITE_MYACCOUNT_URL=$SITE_URL/myaccount/ VITE_AUTH_API_URL=$VITE_AUTH_API_URL npx vite build \
 && cd ../myaccount \
      && BASE_PATH=/myaccount/ VITE_AUTH_URL=$SITE_URL VITE_AUTH_API_URL=$VITE_AUTH_API_URL VITE_ACCOUNT_API_URL=$VITE_ACCOUNT_API_URL npx vite build \
 && cd /app && mkdir -p site/myaccount site/signup site/forgot \
 && cp -r frontend/apps/auth/dist/* site/ \
 && cp -r frontend/apps/myaccount/dist/* site/myaccount/ \
 && cp site/index.html site/signup/index.html && cp site/index.html site/forgot/index.html

CMD ["sh", "-c", ": \"${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN}\" \"${CLOUDFLARE_ACCOUNT_ID:?set CLOUDFLARE_ACCOUNT_ID}\"; wrangler pages deploy site --project-name=$PAGES_PROJECT --branch=$PAGES_BRANCH --commit-dirty=true"]
