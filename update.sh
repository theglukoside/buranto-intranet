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

# 1. Repo klonen
echo "→ Lade neueste Version von GitHub..."
git clone --depth 1 "$REPO_URL" "$TMP_DIR" 2>&1

# 2. Quelldateien aktualisieren (nicht SSL-Zertifikate oder Daten überschreiben)
echo "→ Aktualisiere Dateien..."
rsync -av --exclude='nginx/ssl/' --exclude='.git/' --exclude='node_modules/' --exclude='dist/' "$TMP_DIR/" "$DEPLOY_DIR/" 2>&1

# 3. Container neu bauen
echo "→ Stoppe Container..."
cd "$DEPLOY_DIR"
docker compose down

echo "→ Baue Container neu..."
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
