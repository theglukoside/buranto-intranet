#!/bin/bash
# ============================================
# Buranto Intranet — Videoanlage Proxy Update
# Aktualisiert die Kamera-Proxy Funktionalität
# ============================================
set -e

NAS_USER="dbrandt70"
NAS_IP="192.168.1.235"
DEPLOY_DIR="/volume1/docker/buranto-nas-deploy"

echo "═══════════════════════════════════════"
echo "  Buranto Videoanlage Proxy Update"
echo "═══════════════════════════════════════"
echo ""

echo "→ Stoppe Container..."
ssh ${NAS_USER}@${NAS_IP} "cd ${DEPLOY_DIR} && sudo docker compose down"

echo "→ Aktualisiere Dateien..."
# Update routes.ts (Server-seitiger Kamera-Proxy)
scp app/server/routes.ts ${NAS_USER}@${NAS_IP}:${DEPLOY_DIR}/app/server/routes.ts

# Update use-dahua-data.ts (Frontend Proxy-Integration)
scp app/client/src/hooks/use-dahua-data.ts ${NAS_USER}@${NAS_IP}:${DEPLOY_DIR}/app/client/src/hooks/use-dahua-data.ts

# Update videoanlage.tsx (crossOrigin entfernt)
scp app/client/src/pages/videoanlage.tsx ${NAS_USER}@${NAS_IP}:${DEPLOY_DIR}/app/client/src/pages/videoanlage.tsx

# Update docker-compose.yml (host-bridge Netzwerk für LAN-Zugriff)
scp docker-compose.yml ${NAS_USER}@${NAS_IP}:${DEPLOY_DIR}/docker-compose.yml

echo "→ Baue Container neu..."
ssh ${NAS_USER}@${NAS_IP} "cd ${DEPLOY_DIR} && sudo docker compose build intranet --no-cache"

echo "→ Starte Container..."
ssh ${NAS_USER}@${NAS_IP} "cd ${DEPLOY_DIR} && sudo docker compose up -d intranet nginx"

echo "→ Warte auf Healthcheck..."
sleep 15

echo "→ Container-Status:"
ssh ${NAS_USER}@${NAS_IP} "sudo docker ps --filter 'name=buranto' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"

echo ""
echo "→ Teste Kamera-Proxy..."
ssh ${NAS_USER}@${NAS_IP} "curl -sk -o /dev/null -w '%{http_code}' https://localhost:8443/api/dahua/ping || echo 'Proxy-Test fehlgeschlagen'"

echo ""
echo "═══════════════════════════════════════"
echo "  Update abgeschlossen!"
echo "  → https://192.168.1.235:8443"
echo "═══════════════════════════════════════"
