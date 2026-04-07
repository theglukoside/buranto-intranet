#!/bin/bash
# ============================================
# Self-Signed SSL Zertifikat generieren
# Für lokales Netzwerk (kein Let's Encrypt nötig)
# ============================================

SSL_DIR="$(dirname "$0")/ssl"
mkdir -p "$SSL_DIR"

openssl req -x509 -nodes -days 3650 \
  -newkey rsa:2048 \
  -keyout "$SSL_DIR/buranto.key" \
  -out "$SSL_DIR/buranto.crt" \
  -subj "/C=CH/ST=Basel-Landschaft/L=Sissach/O=Buranto/CN=intranet.buranto.local" \
  -addext "subjectAltName=DNS:intranet.buranto.local,IP:192.168.1.235"

echo ""
echo "✅ SSL-Zertifikat erstellt (gültig 10 Jahre):"
echo "   Zertifikat: $SSL_DIR/buranto.crt"
echo "   Schlüssel:  $SSL_DIR/buranto.key"
echo ""
echo "💡 Um Browser-Warnung zu vermeiden:"
echo "   Importiere '$SSL_DIR/buranto.crt' in deinen Browser"
echo "   oder Schlüsselbund (macOS: Schlüsselbundverwaltung)."
