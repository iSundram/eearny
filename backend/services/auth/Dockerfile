# eearny — auth service image
# Build context: backend/  →  docker build -f services/auth/Dockerfile ..
FROM node:22-alpine
WORKDIR /app

# shared backend deps (jsonwebtoken, used by packages/jwt-auth.js)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# service deps
COPY services/auth/package.json services/auth/package-lock.json ./services/auth/
RUN npm ci --prefix services/auth --omit=dev

# shared code + service source
COPY packages ./packages
COPY services/auth/src ./services/auth/src

ENV NODE_ENV=production
ENV PORT=4001
EXPOSE 4001

CMD ["node", "services/auth/src/server.js"]
