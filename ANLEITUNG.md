# Buranto Intranet — Installation auf Synology DS225

## Übersicht

Das Intranet wird als Docker-Container auf deiner Synology NAS (192.168.1.235) betrieben.
Kein externer Hosting-Anbieter nötig — alles läuft lokal in deinem Netzwerk.

**Architektur:**
```
Browser → Nginx (Port 443/SSL) → Node.js App (Port 5000) → SQLite DB
                                → Digitalstrom Bridge → dSS (192.168.1.129)
```

**Komponenten:**
- `buranto-intranet` — Hauptanwendung (Express + React)
- `buranto-nginx` — Reverse Proxy mit SSL
- `buranto-ds-bridge` — Digitalstrom Bridge (optional)

---

## Voraussetzungen

- Synology DS225 mit DSM 7.2+
- **Container Manager** installiert (Package Center → Container Manager)
- SSH-Zugang aktiviert (Systemsteuerung → Terminal & SNMP → SSH aktivieren)

---

## Schritt 1: SSH-Verbindung

Öffne ein Terminal (Mac) oder PuTTY (Windows):

```bash
ssh admin@192.168.1.235
```

Gib dein Synology-Admin-Passwort ein. Dann wechsle zu Root:

```bash
sudo -i
```

---

## Schritt 2: Verzeichnis erstellen

```bash
mkdir -p /volume1/docker/buranto-intranet
cd /volume1/docker/buranto-intranet
```

---

## Schritt 3: Dateien hochladen

**Option A — SCP vom Computer:**
```bash
# Vom Mac/PC aus (neues Terminalfenster):
scp -r /pfad/zu/buranto-nas-deploy/* admin@192.168.1.235:/volume1/docker/buranto-intranet/
```

**Option B — Synology File Station:**
1. Öffne File Station in DSM
2. Navigiere zu `docker/buranto-intranet/`
3. Lade alle Dateien aus dem `buranto-nas-deploy` Ordner hoch

---

## Schritt 4: App-Quellcode bereitstellen

Das Intranet-Projekt muss im `app/` Unterordner liegen:

```bash
cd /volume1/docker/buranto-intranet
mkdir -p app
```

Kopiere das gesamte Intranet-Projekt (aus dem bisherigen `buranto-intranet/` Ordner) nach `app/`:
```bash
# Alle Projektdateien nach app/ kopieren:
# package.json, package-lock.json, server/, client/, shared/,
# script/, dist/, vite.config.ts, tsconfig.json, 
# tailwind.config.ts, postcss.config.js, drizzle.config.ts,
# components.json, attached_assets/
```

Die Verzeichnisstruktur sollte so aussehen:
```
/volume1/docker/buranto-intranet/
├── docker-compose.yml
├── .env
├── setup.sh
├── nginx/
│   ├── default.conf
│   ├── generate-ssl.sh
│   └── ssl/           (wird automatisch erstellt)
├── app/                ← Intranet-Quellcode hier
│   ├── package.json
│   ├── package-lock.json
│   ├── Dockerfile
│   ├── dist/
│   │   ├── index.cjs
│   │   └── public/
│   ├── server/
│   ├── client/
│   ├── shared/
│   └── ...
└── digitalstrom-bridge/ (optional)
```

---

## Schritt 5: SSL-Zertifikat generieren

```bash
cd /volume1/docker/buranto-intranet
chmod +x nginx/generate-ssl.sh
bash nginx/generate-ssl.sh
```

Dies erstellt ein selbstsigniertes Zertifikat (10 Jahre gültig) für:
- `intranet.buranto.local`
- `192.168.1.235`

**Browser-Warnung entfernen (optional):**
- macOS: Doppelklick auf `buranto.crt` → Schlüsselbund → "Immer vertrauen"
- Windows: `buranto.crt` → Installieren → Vertrauenswürdige Stammzertifizierungsstellen

---

## Schritt 6: Container starten

```bash
cd /volume1/docker/buranto-intranet

# Mit Docker Compose (DSM 7.2+):
docker compose up -d --build
```

Der erste Build dauert ca. 3–5 Minuten (npm install, etc.). Danach starten die Container in Sekunden.

**Status prüfen:**
```bash
docker compose ps
docker logs buranto-intranet
docker logs buranto-nginx
```

---

## Schritt 7: Zugriff testen

Öffne im Browser:
- **https://192.168.1.235** — Direkt über IP
- **http://192.168.1.235** — Leitet automatisch auf HTTPS weiter

Passwort: `buranto-2026`

---

## Schritt 8: Lokale Domain einrichten (optional)

Damit du `https://intranet.buranto.local` statt der IP eingeben kannst:

### macOS:
```bash
sudo nano /etc/hosts
```
Füge hinzu:
```
192.168.1.235   intranet.buranto.local
```

### Windows:
Bearbeite `C:\Windows\System32\drivers\etc\hosts` als Administrator:
```
192.168.1.235   intranet.buranto.local
```

### Synology Router (falls vorhanden):
In der Synology Router Manager (SRM) Oberfläche unter Netzwerk → DNS können lokale DNS-Einträge hinzugefügt werden.

### Fritz!Box / anderer Router:
Unter DNS-Rebind-Schutz bzw. lokale DNS-Einträge:
```
intranet.buranto.local → 192.168.1.235
```

---

## Wartung & Updates

### Container stoppen:
```bash
cd /volume1/docker/buranto-intranet
docker compose down
```

### Intranet aktualisieren:
1. Neue Dateien nach `app/` kopieren
2. `docker compose up -d --build`

### Logs anzeigen:
```bash
docker logs -f buranto-intranet    # Live-Logs Intranet
docker logs -f buranto-nginx       # Live-Logs Nginx
docker logs -f buranto-ds-bridge   # Live-Logs Digitalstrom Bridge
```

### Datenbank-Backup:
```bash
# SQLite-DB liegt im Docker Volume
docker cp buranto-intranet:/app/data/data.db /volume1/backups/buranto-db-$(date +%Y%m%d).db
```

### Container-Neustart bei NAS-Reboot:
Durch `restart: always` in docker-compose.yml starten alle Container automatisch nach einem NAS-Neustart.

---

## Fehlerbehebung

| Problem | Lösung |
|---------|--------|
| Port 80/443 belegt | DSM Web Station deaktivieren oder andere Ports verwenden |
| Container startet nicht | `docker logs buranto-intranet` prüfen |
| SSL-Warnung im Browser | Zertifikat importieren (Schritt 5) |
| Digitalstrom offline | dSS erreichbar? `ping 192.168.1.129` |
| Kein Zugriff von extern | Nur lokal vorgesehen — kein Port-Forwarding nötig |

### Ports ändern (falls 80/443 belegt):
In `docker-compose.yml` die Nginx-Ports anpassen:
```yaml
ports:
  - "8080:80"    # statt 80
  - "8443:443"   # statt 443
```
Dann: `docker compose up -d`

Zugriff dann über: `https://192.168.1.235:8443`

---

## Hostpoint — Was bleibt?

Da das Intranet komplett auf der NAS läuft, brauchst du Hostpoint nur noch für:
- **buranto.com Domain** (DNS bei Swizzonic)
- **E-Mail** (falls über Hostpoint)
- **Öffentliche Website** (falls vorhanden)

Das Intranet-Hosting bei Hostpoint kann gekündigt werden.
