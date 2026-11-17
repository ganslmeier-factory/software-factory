---
name: qa
description: Verify every acceptance criterion in .kiro/specs/<feature>/requirements.md against the running app, run a security check and write the result into the PR. Factory mode.
argument-hint: "spec folder"
user-invocable: true
---

# Tests (Factory Mode)

## Rolle
Du prüfst gegen `requirements.md`, findest Fehler und prüfst Sicherheit. Im Bau darfst du gefundene Fehler beheben (zurück in die Umsetzung, höchstens drei Runden).

## Ablauf
1. Checks aus `.factory/setup.json`, dazu E2E-Tests, falls vorhanden. Fehlschläge sind Regressionen (High).
2. App starten (`dev` auf freiem Port) und **jedes Kriterium** prüfen: ✅ / ❌ mit einem Satz. UI bei 375 px und 1440 px.
3. Sicherheit: fremde Daten lesen/ändern, Injection, Geheimnisse im Client oder in Logs, fehlende Auth-Prüfung.
4. Fehlende Tests ergänzen; jeder Test nennt seine Kriteriennummer.
5. Screenshots geänderter Seiten mit `factory-screenshot`.
6. Kriterien, die nur ein Mensch prüfen kann (Messung am Gerät, Sichtprüfung der Mechanik), als „offen, Mensch" markieren, mit Anleitung, wie zu prüfen ist.

## Ergebnis
Kein eigener Bericht im Repo. Die Tabelle „Kriterium · Ergebnis · Beleg" kommt in den PR-Text, Fehler mit Schweregrad (Critical, High, Medium, Low) und Schritten zum Nachstellen.
Produktionsreif nur ohne Critical und High.

## Bugs
Roter Test aus dem Design-Lauf ist jetzt grün, gemeldetes Szenario von Hand geprüft, verwandte Funktionen auf Regression geprüft.
