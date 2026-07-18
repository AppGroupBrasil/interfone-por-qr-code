# =====================================
# Build Stage — Frontend + Server
# =====================================
FROM node:20.18-alpine AS builder

WORKDIR /app

# Install build dependencies for canvas (needed for face recognition)
RUN apk add --no-cache python3 make g++ pkgconfig pixman-dev cairo-dev pango-dev jpeg-dev giflib-dev

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build frontend (Vite)
RUN npm run build

# OTA bundle (Capgo self-hosted): zip do dist + manifest com checksum SHA-256
RUN node scripts/build-ota-bundle.mjs

# Build server (TypeScript → JavaScript)
RUN npm run build:server

# =====================================
# Production Stage
# =====================================
FROM node:20.18-alpine AS production

# Install runtime dependencies for canvas and create non-root user
# tzdata: fuso horário IANA (America/Sao_Paulo) para new Date() usar horário local do Brasil
RUN apk add --no-cache pixman cairo pango jpeg giflib tzdata && \
    addgroup -g 1001 -S appinterfone && \
    adduser -S appinterfone -u 1001

WORKDIR /app

# Copy package files and install production deps only
COPY package.json package-lock.json ./
RUN apk add --no-cache --virtual .build-deps \
    python3 make g++ pkgconfig \
    pixman-dev cairo-dev pango-dev \
    jpeg-dev giflib-dev \
    && npm ci --omit=dev \
    && apk del .build-deps

# Copy built frontend from builder
COPY --from=builder /app/dist ./dist

# Copy compiled server from builder
COPY --from=builder /app/dist-server ./dist-server

# OTA bundle — registrado no volume /app/data/ota pelo initOta() no boot
COPY --from=builder /app/ota-build ./ota-build

# Firebase service account: NÃO copiada aqui — montar via secret/volume em runtime.
# Caminho lido de FIREBASE_SERVICE_ACCOUNT_PATH (default ./server/firebase-service-account.json).

# Copy public assets (logo, etc.)
COPY public ./public

# Copy face recognition models
COPY public/models ./public/models

# Create data + backup directories for SQLite and set ownership
RUN mkdir -p /app/data /app/backups && \
    chown -R appinterfone:appinterfone /app/data /app/backups && \
    chown -R appinterfone:appinterfone /app

# Switch to non-root user
USER appinterfone

# Environment
ENV NODE_ENV=production
ENV PORT=3001
ENV TZ=America/Sao_Paulo

# Expose port
EXPOSE 3001

# Health check (longer start-period for face model loading)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

# Start compiled server directly with Node
CMD ["node", "dist-server/index.js"]
