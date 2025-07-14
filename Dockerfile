# -------- 1️⃣  Builder stage --------
FROM node:20-slim AS builder

# Optional: leverage BuildKit’s cache for npm
RUN --mount=type=cache,id=nodecache,target=/root/.npm \
    corepack enable && corepack prepare npm@latest --activate

WORKDIR /app
COPY package.json package-lock.json* ./

# Install **all** deps so TypeScript & Prisma can compile
RUN --mount=type=cache,id=nodecache,target=/root/.npm \
    npm ci

# Generate Prisma client & compile TS → JS
COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig*.json ./
COPY src ./src
RUN npm run build         # writes to /app/dist

# -------- 2️⃣  Prune stage (optional but nice) --------
FROM builder AS prune
RUN npm prune --omit=dev  # strip devDependencies

# -------- 3️⃣  Runtime stage --------
FROM node:20-slim

# OS deps strictly required **at runtime** (cairo etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    libssl3 \
    libcairo2 \
    libjpeg62-turbo \
    libpango-1.0-0 \
    libgif7 \
    librsvg2-2 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN npm install --no-save --omit=peer ts-node

# Generate Prisma client & compile TS → JS
COPY prisma ./prisma
RUN npx prisma generate

# Copy production node_modules and dist only
COPY --from=prune /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist

# If you truly need PM2:
# RUN npm i -g pm2@latest && pm2 install pm2-logrotate
# Otherwise just use node:
ENV NODE_ENV=production PORT=3000
EXPOSE 3000

CMD ["node", "dist/index.js"]