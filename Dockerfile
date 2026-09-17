FROM docker.io/library/node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm run db:generate
RUN npm run build
RUN npm prune --omit=dev

FROM docker.io/library/node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder --chown=node:node /app/package.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/src/views ./src/views
COPY --from=builder --chown=node:node /app/src/public ./src/public

EXPOSE 3000

USER node

CMD ["npm", "run", "start"]
