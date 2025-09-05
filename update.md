1. Richtige Update-Methode verwenden:
      cd /opt/mioty-web-console
      ./update.sh
2. Falls update.sh nicht ausführbar ist:
      cd /opt/mioty-web-console
      chmod +x ./update.sh
      ./update.sh
3. Manual Update (wenn update.sh fehlt):
      cd /opt/mioty-web-console
# Service stoppen
      sudo systemctl stop mioty-web-console
# Neue Version holen
      git pull origin main
# Dependencies aktualisieren
      npm install
# Neu builden
      npm run build
# Service neu starten
      sudo systemctl start mioty-web-console