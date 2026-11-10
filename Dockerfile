# eearny — backend image (auth + account services behind ONE port).
#   docker build -t eearny-backend .
#   docker run -p 4000:4000 -e JWT_SECRET=<long-random> -v eearny-data:/data eearny-backend
#
# Routes: /api/auth/* -> auth service, /api/account/* -> account service, /health.
# (The frontend → Cloudflare Pages deploy image lives in Dockerfile.frontend.)
FROM node:22-alpine
WORKDIR /app

# shared backend deps (jsonwebtoken, used by packages/jwt-auth.js)
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# per-service deps
COPY backend/services/auth/package.json backend/services/auth/package-lock.json ./services/auth/
COPY backend/services/account/package.json backend/services/account/package-lock.json ./services/account/
RUN npm ci --prefix services/auth --omit=dev && npm ci --prefix services/account --omit=dev

# shared code + sources
COPY backend/packages ./packages
COPY backend/services/auth/src ./services/auth/src
COPY backend/services/account/src ./services/account/src
COPY backend/gateway.js ./gateway.js

# JSON-file data → one persistent volume (symlinks keep the code's relative data dirs working)
RUN mkdir -p /data/auth /data/account /data/sessions \
 && ln -s /data/auth services/auth/data \
 && ln -s /data/account services/account/data \
 && ln -s /data/sessions data
VOLUME /data

ENV NODE_ENV=production PORT=4000
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:4000/health || exit 1
CMD ["node", "gateway.js"]
