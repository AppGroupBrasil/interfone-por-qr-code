# =====================================
# Build Stage — Frontend + Server
# =====================================
FROM node:20.18-alpine AS builder

WORKDIR /app

# Toolchain só para o better-sqlite3 (não há prebuild musl). cairo/pango/pixman
# saíram junto com o canvas: reconhecimento facial está fora do escopo v1 e sua
# compilação nativa não pode ficar no caminho crítico do deploy.
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
# JOBS=1: node-gyp compila serialmente. Em paralelo o pico de RAM do gcc derruba
# o build por OOM em host carregado — e um npm ci que falha aborta o deploy.
RUN JOBS=1 npm ci

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

# tzdata: fuso horário IANA (America/Sao_Paulo) para new Date() usar horário local do Brasil.
# cairo/pango/pixman/jpeg/giflib saíram: o escopo v1 é interfonia, o módulo de face
# não sobe e canvas virou devDependency — a imagem final fica sem toolchain nem
# libs nativas (menos superfície de CVE, imagem menor, build mais rápido).
RUN apk add --no-cache tzdata && \
    addgroup -g 1001 -S appinterfone && \
    adduser -S appinterfone -u 1001

WORKDIR /app

# Copy package files and install production deps only.
# better-sqlite3 não publica prebuild para musl (só linux-x64/glibc), então em
# Alpine o prebuild-install falha e o install cai no node-gyp. Sem esta toolchain
# o `npm ci` quebra o build. Ela é virtual e sai no mesmo RUN — a imagem final
# continua sem compilador. (canvas saiu: era quem exigia cairo/pango/pixman.)
COPY package.json package-lock.json ./
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
    && JOBS=1 npm ci --omit=dev \
    && apk del .build-deps

# Copy built frontend from builder
COPY --from=builder /app/dist ./dist

# Copy compiled server from builder
COPY --from=builder /app/dist-server ./dist-server

# OTA bundle — registrado no volume /app/data/ota pelo initOta() no boot
COPY --from=builder /app/ota-build ./ota-build

# Firebase service account: NÃO copiada aqui — montar via secret/volume em runtime.
# Caminho lido de FIREBASE_SERVICE_ACCOUNT_PATH (default ./server/firebase-service-account.json).

# Copy public assets (logo, ícones, manifest). public/models fica fora pelo
# .dockerignore — o escopo v1 não carrega face.
COPY public ./public

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

# Health check — /api/ready faz SELECT no SQLite; /api/health só diz que o
# processo respondeu e aprovaria o container com o banco fora do ar.
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/api/ready', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))" || exit 1

# Start compiled server directly with Node
CMD ["node", "dist-server/index.js"]
