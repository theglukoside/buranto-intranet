# ============================================
# Buranto Intranet — Dockerfile für Synology DS225
# Multi-Stage Build: Build + Production
# ============================================

# Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /app

# Abhängigkeiten installieren
COPY package.json package-lock.json ./
RUN npm ci

# Quellcode kopieren
COPY . .

# Client + Server bauen
RUN npm run build

# Stage 2: Production
FROM node:20-slim AS production

WORKDIR /app

# Nur Produktions-Abhängigkeiten
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Build-Artefakte kopieren
COPY --from=builder /app/dist ./dist

# Datenverzeichnis
RUN mkdir -p /app/data /app/uploads

# Umgebungsvariablen
ENV NODE_ENV=production
ENV PORT=5000

# Gesundheitscheck
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:5000').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

EXPOSE 5000

CMD ["node", "dist/index.cjs"]
