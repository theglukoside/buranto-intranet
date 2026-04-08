#!/bin/bash
# ============================================
# Buranto Intranet — Auto-Update von GitHub
# Verwendung: sudo bash update.sh
# ============================================
set -e

DEPLOY_DIR="/volume1/docker/buranto-nas-deploy"
REPO_URL="https://github.com/theglukoside/buranto-intranet.git"
TMP_DIR="/tmp/buranto-update-$(date +%s)"

echo "═══════════════════════════════════════"
echo "  Buranto Intranet — Update"
echo "═══════════════════════════════════════"
echo ""

# 1. Repo klonen via Docker (git ist auf Synology nicht immer verfügbar)
echo "→ Lade neueste Version von GitHub..."
mkdir -p "$TMP_DIR"
docker run --rm -v "$TMP_DIR:/repo" alpine/git clone --depth 1 "$REPO_URL" /repo 2>&1

# 2. Quelldateien aktualisieren (SSL-Zertifikate und Daten nicht überschreiben)
echo "→ Aktualisiere Dateien..."

# Gesamter app-Ordner (ausser node_modules und dist)
rsync -a --delete \
  --exclude='node_modules/' \
  --exclude='dist/' \
  --exclude='.env' \
  "$TMP_DIR/app/" "$DEPLOY_DIR/app/"

# Docker & Nginx Config
cp "$TMP_DIR/docker-compose.yml" "$DEPLOY_DIR/docker-compose.yml"
cp "$TMP_DIR/nginx/default.conf" "$DEPLOY_DIR/nginx/default.conf"

# Update-Script selbst aktualisieren
cp "$TMP_DIR/update.sh" "$DEPLOY_DIR/update.sh"

# 3. Container neu bauen
echo "→ Stoppe Container..."
cd "$DEPLOY_DIR"
docker compose down

echo "→ Baue Container neu (dauert ca. 2-3 Minuten)..."
docker compose build intranet --no-cache

echo "→ Starte Container..."
docker compose up -d

# 4. Aufräumen
rm -rf "$TMP_DIR"

echo ""
echo "→ Warte auf Healthcheck..."
sleep 15

echo "→ Container-Status:"
docker ps --filter 'name=buranto' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

echo ""
echo "═══════════════════════════════════════"
echo "  Update abgeschlossen!"
echo "  → https://192.168.1.235:8443"
echo "═══════════════════════════════════════"
