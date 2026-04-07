#!/bin/bash
# ============================================
# BURANTO INTRANET — One-Click Synology Setup
# Führe dieses Script als root auf der NAS aus
# ============================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "================================================"
echo -e "  ${YELLOW}BURANTO INTRANET${NC} — Synology NAS Installation"
echo "================================================"
echo ""

# Arbeitsverzeichnis
DEPLOY_DIR="/volume1/docker/buranto-intranet"

# ---- Schritt 1: Docker prüfen ----
echo -e "${YELLOW}[1/6]${NC} Prüfe Docker..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker nicht gefunden!${NC}"
    echo "  → Installiere 'Container Manager' aus dem Synology Package Center"
    echo "  → DSM → Package Center → Container Manager → Installieren"
    exit 1
fi
echo -e "${GREEN}✓${NC} Docker gefunden: $(docker --version)"

if docker compose version &> /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    echo -e "${RED}✗ Docker Compose nicht gefunden!${NC}"
    echo "  → Container Manager sollte Docker Compose mitbringen"
    exit 1
fi
echo -e "${GREEN}✓${NC} Docker Compose verfügbar"

# ---- Schritt 2: Verzeichnis einrichten ----
echo ""
echo -e "${YELLOW}[2/6]${NC} Richte Verzeichnis ein..."
mkdir -p "$DEPLOY_DIR"

# Prüfe ob wir im richtigen Verzeichnis sind
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ "$SCRIPT_DIR" != "$DEPLOY_DIR" ]; then
    echo "  Kopiere Dateien nach $DEPLOY_DIR..."
    cp -r "$SCRIPT_DIR"/* "$DEPLOY_DIR/" 2>/dev/null || true
    cp -r "$SCRIPT_DIR"/.env "$DEPLOY_DIR/" 2>/dev/null || true
fi
cd "$DEPLOY_DIR"
echo -e "${GREEN}✓${NC} Verzeichnis: $DEPLOY_DIR"

# ---- Schritt 3: Prüfe App-Dateien ----
echo ""
echo -e "${YELLOW}[3/6]${NC} Prüfe Projektdateien..."
if [ ! -f "app/dist/index.cjs" ]; then
    echo -e "${RED}✗ Build-Dateien nicht gefunden!${NC}"
    echo "  Erwartet: $DEPLOY_DIR/app/dist/index.cjs"
    echo "  Bitte stelle sicher, dass das app/ Verzeichnis vollständig ist."
    exit 1
fi
if [ ! -f "app/package.json" ]; then
    echo -e "${RED}✗ package.json nicht gefunden!${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Projektdateien vorhanden"

# ---- Schritt 4: SSL-Zertifikat ----
echo ""
echo -e "${YELLOW}[4/6]${NC} SSL-Zertifikat..."
mkdir -p nginx/ssl
if [ ! -f "nginx/ssl/buranto.crt" ]; then
    echo "  Generiere Self-Signed Zertifikat (10 Jahre)..."
    openssl req -x509 -nodes -days 3650 \
        -newkey rsa:2048 \
        -keyout nginx/ssl/buranto.key \
        -out nginx/ssl/buranto.crt \
        -subj "/C=CH/ST=Basel-Landschaft/L=Sissach/O=Buranto/CN=intranet.buranto.local" \
        -addext "subjectAltName=DNS:intranet.buranto.local,IP:192.168.1.235" \
        2>/dev/null
    echo -e "${GREEN}✓${NC} SSL-Zertifikat erstellt"
else
    echo -e "${GREEN}✓${NC} SSL-Zertifikat existiert bereits"
fi

# ---- Schritt 5: Port-Konflikte prüfen ----
echo ""
echo -e "${YELLOW}[5/6]${NC} Prüfe Ports..."
PORT80_PID=$(lsof -ti:80 2>/dev/null || true)
PORT443_PID=$(lsof -ti:443 2>/dev/null || true)

if [ -n "$PORT80_PID" ] || [ -n "$PORT443_PID" ]; then
    echo -e "${YELLOW}⚠ Port 80 und/oder 443 sind belegt (DSM Web Station?)${NC}"
    echo "  Verwende alternative Ports 8080/8443..."
    
    # Passe docker-compose.yml an
    sed -i 's/"80:80"/"8080:80"/g' docker-compose.yml 2>/dev/null || true
    sed -i 's/"443:443"/"8443:443"/g' docker-compose.yml 2>/dev/null || true
    
    HTTPS_PORT="8443"
    echo -e "${GREEN}✓${NC} Ports angepasst: HTTP=8080, HTTPS=8443"
else
    HTTPS_PORT="443"
    echo -e "${GREEN}✓${NC} Ports 80/443 frei"
fi

# ---- Schritt 6: Container starten ----
echo ""
echo -e "${YELLOW}[6/6]${NC} Starte Docker Container..."
echo "  (Erster Build dauert ca. 3-5 Minuten...)"
echo ""

$COMPOSE_CMD down 2>/dev/null || true
$COMPOSE_CMD up -d --build 2>&1

echo ""
echo "  Warte auf Gesundheitscheck..."
sleep 10

# Status prüfen
INTRANET_STATUS=$(docker inspect --format='{{.State.Status}}' buranto-intranet 2>/dev/null || echo "nicht gefunden")
NGINX_STATUS=$(docker inspect --format='{{.State.Status}}' buranto-nginx 2>/dev/null || echo "nicht gefunden")

echo ""
echo "================================================"
if [ "$INTRANET_STATUS" = "running" ] && [ "$NGINX_STATUS" = "running" ]; then
    echo -e "  ${GREEN}✅ Installation erfolgreich!${NC}"
    echo "================================================"
    echo ""
    echo "  Zugriff im Browser:"
    if [ "$HTTPS_PORT" = "443" ]; then
        echo -e "    ${GREEN}https://192.168.1.235${NC}"
    else
        echo -e "    ${GREEN}https://192.168.1.235:${HTTPS_PORT}${NC}"
    fi
    echo ""
    echo "  Passwort: buranto-2026"
    echo ""
    echo "  Container-Status:"
    echo "    Intranet: $INTRANET_STATUS"
    echo "    Nginx:    $NGINX_STATUS"
    echo ""
    echo "  Nützliche Befehle:"
    echo "    Logs:     docker logs -f buranto-intranet"
    echo "    Stoppen:  cd $DEPLOY_DIR && $COMPOSE_CMD down"
    echo "    Starten:  cd $DEPLOY_DIR && $COMPOSE_CMD up -d"
    echo "    Update:   cd $DEPLOY_DIR && $COMPOSE_CMD up -d --build"
else
    echo -e "  ${RED}⚠ Problem beim Start!${NC}"
    echo "================================================"
    echo ""
    echo "  Container-Status:"
    echo "    Intranet: $INTRANET_STATUS"
    echo "    Nginx:    $NGINX_STATUS"
    echo ""
    echo "  Prüfe Logs:"
    echo "    docker logs buranto-intranet"
    echo "    docker logs buranto-nginx"
fi
echo ""
echo "================================================"
