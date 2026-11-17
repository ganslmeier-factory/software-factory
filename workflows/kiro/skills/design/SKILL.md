---
name: design
description: Turn an approved requirements.md into design.md and tasks.md under .kiro/specs/<feature>/. No production code. Factory mode.
argument-hint: "spec folder"
user-invocable: true
---

# Design (Factory Mode)

## Rolle
Du übersetzt die Anforderungen in einen Lösungsentwurf und einen Umsetzungsplan. Kein Produktivcode.

## Vorher lesen
1. `.kiro/specs/<feature>/requirements.md`. Nur lesen, nie ändern. Fehlt sie: `factory-report question "<Befund>" --question "<Frage mit Optionen>"`.
2. `.kiro/steering/product.md`, `tech.md`, `structure.md`. Fehlen sie, Stack und Konventionen aus dem Repo ableiten (Manifeste, Konfiguration, bestehender Code).
3. Stack-Packs aus `tech.md`: `/factory/workflows/kiro/stacks/<name>.md`.
4. Bestehendes: `git ls-files | head -200`, verwandte Specs unter `.kiro/specs/`.
5. Bleib im Stack aus `tech.md`. Neues Framework, neue Datenbank oder neuer Dienst nur, wenn die Anforderungen es zwingend verlangen, und dann erst nach Rückfrage.

## design.md
Vorlage: `/factory/workflows/kiro/templates/design.md`. Pflicht:
- Überblick, Architektur, Komponenten und Schnittstellen, Datenmodell
- Fehlerbehandlung mit Bezug auf die FALLS-Kriterien
- **Teststrategie**: für jedes Kriterium aus `requirements.md`, wie es geprüft wird (Unit, E2E, Messung, Sichtprüfung). Kein Kriterium ohne Prüfweg.
- Entscheidungen mit Alternative und Abwägung

Bei Hardware: Schaltungs- und Mechanik-Entscheidungen, Teileliste mit Bezugsquelle, Messaufbau für Mess-Kriterien.

## tasks.md
Vorlage: `/factory/workflows/kiro/templates/tasks.md`.
- Kleine, der Reihe nach abarbeitbare Schritte; jeder endet mit etwas Prüfbarem (Test grün, Seite zeigt X).
- Jede Aufgabe nennt die Kriterien, die sie erfüllt: `_Anforderungen: 1.1, 2.3_`. Jedes Kriterium kommt in mindestens einer Aufgabe vor.
- Tests gehören in dieselbe Aufgabe wie der Code, nicht ans Ende.
- Nur Arbeit, die die Factory selbst erledigen kann. Was ein Mensch tun muss (Konto anlegen, Messung am Gerät), steht als eigene Aufgabe mit „(Mensch)" und bleibt offen.

## Abschluss
Commit `docs(<feature>): Design und Umsetzungsplan (#<issue-nr>)`, pushen. Dann `designed` oder `design_review` melden, wie in der ersten Nachricht angegeben.
