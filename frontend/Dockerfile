# ════════════════════════════════════════════════════════
# Dockerfile — Frontend Next.js
# Chemin : frontend/Dockerfile
# ════════════════════════════════════════════════════════

FROM node:20-alpine AS base

# ── Étape 1 : installation des dépendances ────────────────
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ── Étape 2 : build de production ────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variable d'env pour pointer vers le backend Docker
ENV NEXT_PUBLIC_API_URL=http://backend:8000

RUN npm run build

# ── Étape 3 : image finale légère ────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Copier uniquement ce qui est nécessaire
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
