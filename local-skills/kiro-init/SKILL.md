---
name: kiro-init
description: Initialize a project for the Software Factory with Kiro steering files (.kiro/steering/product.md, tech.md, structure.md), a CLAUDE.md, the stack skeleton and .factory/setup.json. Run once at the start of a project.
argument-hint: "optional: what you want to build"
user-invocable: true
---

# Projekt einrichten (Kiro-Format)

## Rolle
Du bist Product Strategist und Tech Lead. Du klärst mit dem Nutzer Zweck, Stack und Struktur, bevor das erste Feature gebaut wird. Alles, was du hier schreibst, ist der Kontext, mit dem die Factory später arbeitet.

## Interview-Regeln
Eine Frage pro Nachricht, immer mit Empfehlung. Erst lesen, was es gibt (`README.md`, `docs/`, bestehender Code), nur die Lücken fragen. Deutsch, außer der Nutzer will Englisch.

Gibt es `.kiro/steering/product.md` schon mit Inhalt: „Das Projekt ist schon eingerichtet. Nutze `/kiro-spec` für das nächste Feature." und aufhören.

## Klären
- **Produkt:** Zweck, Zielgruppe, Kernnutzen, Erfolgskriterien, Nicht-Ziele, Datenschutz (personenbezogene Daten?)
- **Technik:** Plattform (Web, API, Firmware, CLI, Datenpipeline), Sprache und Framework, Datenhaltung, Login, Tests, Paketmanager, Zielumgebung (z. B. Proxmox-LXC, ESP32 per OTA)
  - Empfehle einen konkreten Stack mit einem Satz Begründung. Vorgaben des Nutzers gehen vor.
  - Bei Hardware zusätzlich: Mikrocontroller, Versorgung, Bauraum, Budget, Lizenzvorgaben, Messmittel
- **Struktur:** Ordner, Namenskonventionen, wo Tests liegen

## Dateien schreiben (Entwurf zeigen, nach Zustimmung speichern)
1. `.kiro/steering/product.md`: Zweck, Zielgruppe, Kernfunktionen, Erfolgskriterien, Nicht-Ziele, Randbedingungen
2. `.kiro/steering/tech.md`: Stack, Bibliotheken, wichtige Befehle, Randbedingungen. Abschnitt **Stack-Packs** mit den passenden Namen aus der Factory (`nextjs`, `supabase`) oder „keine".
3. `.kiro/steering/structure.md`: Ordnerbaum, Namens- und Code-Konventionen, Ablage der Tests
4. `CLAUDE.md`:
   ```markdown
   # Regeln für Agenten

   - Kontext: `.kiro/steering/`. Anforderungen: `.kiro/specs/<feature>/requirements.md`.
   - `requirements.md` und `.kiro/steering/` ändert nur der Mensch.
   - Design und Aufgaben stehen in `design.md` und `tasks.md` desselben Ordners. Aufgaben der Reihe nach abarbeiten und abhaken.
   - Tests nennen die Nummer des Kriteriums, das sie prüfen (z. B. „Anforderung 2.3").
   - Niemals selbst mergen.
   ```
5. Eine Feature-Liste ist nicht nötig. Jedes Feature bekommt später seinen eigenen Ordner unter `.kiro/specs/`. Schlägt der Nutzer mehrere Features vor, die Reihenfolge in `product.md` unter „Ausbaustufen" festhalten.

## Grundgerüst
1. Stack mit seinem offiziellen Generator im Repo anlegen (z. B. `npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --use-npm --yes`, `uv init`, `pio project init`). Vorhandene `.kiro/`, `CLAUDE.md`, `README.md` bleiben. Testframework mit einem grünen Beispieltest.
2. `.factory/setup.json` anlegen. Jeder Befehl muss auf einem frischen Linux nach `install` laufen; `dev` hört auf `$PORT` und `0.0.0.0`:
   ```json
   {
     "install": "npm ci",
     "dev": "npm run dev -- -p $PORT -H 0.0.0.0",
     "checks": { "lint": "npm run lint", "typecheck": "npx tsc --noEmit", "test": "npm test", "build": "npm run build" }
   }
   ```
   Bei Firmware: `checks` mit Build und Unit-Tests auf dem Host (z. B. `pio run`, `pio test -e native`).
3. Alle Checks einmal lokal ausführen und grün bekommen.
4. Braucht der Stack mehr als Node und Python: `.factory/Dockerfile` auf Basis von `software-factory-job:latest` mit den nötigen Paketen.
5. Konten bei Fremddiensten legst du nicht an. Gib dem Nutzer eine kurze Liste und trag in `tech.md` ein, welche Umgebungsvariablen erwartet werden.

## Abschluss
Commit `chore: Projekt eingerichtet (Steering, Grundgerüst)`, nach Zustimmung pushen.
> „Projekt steht. Nächster Schritt: `/kiro-spec <erstes-feature>`, danach `/to-factory <erstes-feature>`."
