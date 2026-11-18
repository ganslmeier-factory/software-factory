---
name: build
description: Implement a feature by working through .kiro/specs/<feature>/tasks.md in order, following design.md and requirements.md. Ticks off each task. Factory mode.
argument-hint: "spec folder"
user-invocable: true
---

# Umsetzung (Factory Mode)

## Rolle
Du setzt `tasks.md` um, so wie `design.md` es plant. `requirements.md` ist der Vertrag, `design.md` die Vorgabe. Beide änderst du nicht. Passt etwas nicht zusammen oder ist unmöglich: `factory-report question "<Befund>" --question "<Frage mit Optionen>"`.

## Vorher lesen
1. `.kiro/specs/<feature>/requirements.md`, `design.md`, `tasks.md` und die Bilder in `assets/` (verbindlich ist, was `requirements.md` dazu sagt)
2. `.kiro/steering/tech.md` und `structure.md` sind verbindlich; Stack-Packs unter `/factory/workflows/kiro/stacks/<name>.md`
3. `.factory/setup.json` (install, dev, checks)
4. Was es schon gibt: `git ls-files | head -200`; vorhandene Komponenten wiederverwenden

## Ablauf je Aufgabe
1. Nächste offene Aufgabe in `tasks.md` nehmen (Reihenfolge einhalten, Aufgaben mit „(Mensch)" überspringen)
2. Umsetzen, Tests für die genannten Kriterien dazu schreiben; Test nennt die Kriteriennummer im Namen oder Kommentar (`Anforderung 2.3`)
3. Checks aus `.factory/setup.json` laufen lassen, bis grün
4. In `tasks.md` abhaken (`- [x]`), committen: `feat(<feature>): <Aufgabe> (#<issue-nr>)`
5. Bei Bedarf `factory-report implementing "<Aufgabe n von m>"` als Zwischenstand

## Qualität
- Backend: Migrationen statt Hand-SQL, Zugriffsregeln, Eingaben prüfen, Auth auf geschützten Routen, keine Geheimnisse im Code
- UI: Lade-, Fehler- und Leer-Zustand; 375 px und 1440 px; Tastatur bedienbar
- Keine Mock-Daten im Ergebnis

## Abweichungen
Weicht die Umsetzung begründet von `design.md` ab, steht das im PR unter „Annahmen". `design.md` bleibt unverändert.

## Wiederaufnahme
Nach Kontext-Verlust: `tasks.md` (was ist abgehakt), `git log --oneline -10`, `git diff`, dort weitermachen.
