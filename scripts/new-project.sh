#!/usr/bin/env bash
# Legt ein neues Projekt aus dem Factory-Template an und hängt es an deine Factory.
# Läuft auf deinem Rechner (nicht auf dem Server).
#
#   ./scripts/new-project.sh <projektname> [--public]
#
# Einstellungen (Umgebungsvariablen oder ~/.config/software-factory/env):
#   FACTORY_SERVER    SSH-Ziel deines Servers, z. B. root@203.0.113.10
#   FACTORY_OWNER     Konto oder Organisation für das neue Repo (Standard: dein GitHub-Login)
#   FACTORY_TEMPLATE  optionales Template-Repo; ohne wird ein leeres Repo angelegt und /kiro-init richtet es ein
#   FACTORY_DIR       Pfad der Factory auf dem Server (Standard: /opt/software-factory)
set -euo pipefail
[ -f "$HOME/.config/software-factory/env" ] && . "$HOME/.config/software-factory/env"

NAME="${1:?Aufruf: ./scripts/new-project.sh <projektname> [--public]}"
VISIBILITY="--private"; [ "${2:-}" = "--public" ] && VISIBILITY="--public"
TEMPLATE="${FACTORY_TEMPLATE:-}"
SERVER="${FACTORY_SERVER:?FACTORY_SERVER fehlt, z. B. export FACTORY_SERVER=root@1.2.3.4}"
FDIR="${FACTORY_DIR:-/opt/software-factory}"
OWNER="${FACTORY_OWNER:-$(gh api user --jq .login)}"
REPO="$OWNER/$NAME"

if [ -n "$TEMPLATE" ]; then
  echo "▶ Repo $REPO aus $TEMPLATE anlegen"
  gh repo create "$REPO" $VISIBILITY --template "$TEMPLATE" >/dev/null
  # GitHub erzeugt das Repo aus dem Template asynchron: kurz warten, bis der erste Commit da ist
  for i in $(seq 1 30); do gh api "repos/$REPO/commits?per_page=1" >/dev/null 2>&1 && break; sleep 2; done
else
  echo "▶ Leeres Repo $REPO anlegen"
  gh repo create "$REPO" $VISIBILITY --add-readme >/dev/null
fi
gh repo clone "$REPO" "$NAME" -- --quiet
cd "$NAME"

echo "▶ An die Factory auf $SERVER hängen"
# Config und gh-Login liegen beim root-Konto des Servers
SUDO="sudo "; case "$SERVER" in root@*) SUDO="" ;; esac
ssh -t "$SERVER" "cd $FDIR && ${SUDO}./scripts/add-repo.sh $REPO"

echo
echo "Fertig: $(pwd)"
echo "Nächste Schritte:"
echo "  1. Claude Code hier starten und /kiro-init ausführen (einmalig)"
echo "  2. Pro Feature: /kiro-spec <feature>, dann /to-factory <feature>"
