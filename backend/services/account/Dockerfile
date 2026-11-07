# eearny — account service image
# Build context: backend/  →  docker build -f services/account/Dockerfile ..
FROM node:22-alpine
WORKDIR /app

# shared backend deps (jsonwebtoken, used by packages/jwt-auth.js)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# service deps
COPY services/account/package.json services/account/package-lock.json ./services/account/
RUN npm ci --prefix services/account --omit=dev

# shared code + service source
COPY packages ./packages
COPY services/account/src ./services/account/src

ENV NODE_ENV=production
ENV PORT=4002
EXPOSE 4002

CMD ["node", "services/account/src/server.js"]
