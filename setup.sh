#!/bin/bash
# ============================================
# Buranto Intranet — Synology NAS Setup Script
# Automatische Installation & Konfiguration
# ============================================

set -e

echo "================================================"
echo "  BURANTO INTRANET — Synology NAS Installation"
echo "================================================"
echo ""

DEPLOY_DIR="/volume1/docker/buranto-intranet"

# 1. Verzeichnisstruktur erstellen
echo "📁 Erstelle Verzeichnisstruktur..."
mkdir -p "$DEPLOY_DIR"
cp -r . "$DEPLOY_DIR/"
cd "$DEPLOY_DIR"

# 2. SSL-Zertifikat generieren
echo "🔐 Generiere SSL-Zertifikat..."
chmod +x nginx/generate-ssl.sh
bash nginx/generate-ssl.sh

# 3. App-Verzeichnis vorbereiten
echo "📦 Bereite Anwendung vor..."
mkdir -p app
if [ ! -f app/package.json ]; then
  echo "⚠️  Bitte kopiere das Buranto Intranet Projekt in: $DEPLOY_DIR/app/"
  echo "    (package.json, dist/, server/, shared/, etc.)"
  echo ""
  echo "    Alternativ: Entpacke das buranto-intranet.tar.gz:"
  echo "    tar -xzf buranto-intranet.tar.gz -C app/"
  echo ""
fi

# 4. Docker Compose starten
echo "🐳 Starte Docker Container..."
if command -v docker-compose &> /dev/null; then
  docker-compose up -d --build
elif docker compose version &> /dev/null; then
  docker compose up -d --build
else
  echo "❌ Docker Compose nicht gefunden!"
  echo "   Bitte installiere Container Manager aus dem Synology Package Center."
  exit 1
fi

echo ""
echo "================================================"
echo "  ✅ Installation abgeschlossen!"
echo "================================================"
echo ""
echo "  Zugriff im Browser:"
echo "    https://192.168.1.235"
echo "    https://intranet.buranto.local (nach DNS-Setup)"
echo ""
echo "  Standard-Passwort: buranto-2026"
echo ""
echo "  Logs anzeigen:"
echo "    docker logs buranto-intranet"
echo "    docker logs buranto-nginx"
echo ""
echo "  Stoppen:  docker compose down"
echo "  Starten:  docker compose up -d"
echo "  Update:   docker compose up -d --build"
echo "================================================"
