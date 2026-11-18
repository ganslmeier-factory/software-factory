# Workflow: Kiro (Spec-Driven)

Specs nach dem Muster von [Kiro](https://kiro.dev/docs/specs/): pro Feature drei Dateien, die nacheinander entstehen.
Der Mensch schreibt die Anforderungen, die Factory schreibt Design und Aufgaben und setzt sie um.

## Ablage im Projekt-Repo

```
.kiro/
  steering/                      projektweiter Kontext, gilt für jedes Feature
    product.md                   Zweck, Zielgruppe, Ziele, Nicht-Ziele
    tech.md                      Stack, Bibliotheken, Befehle, Randbedingungen (auch Hardware)
    structure.md                 Ordnerstruktur, Namens- und Code-Konventionen
  specs/
    <feature-name>/              kebab-case, z. B. kursanzeige
      requirements.md            WAS: User Stories + Abnahmekriterien in EARS (Mensch)
      design.md                  WIE: Architektur, Komponenten, Daten, Fehlerfälle, Teststrategie (Factory)
      tasks.md                   Umsetzungsplan als Checkliste mit Bezug auf die Kriterien (Factory)
.factory/setup.json              install, dev, checks
```

Nur der Mensch ändert `requirements.md`, `.kiro/steering/`, `.factory/setup.json`, `.factory/Dockerfile`, `.github/workflows/`, `CLAUDE.md` und `AGENTS.md`. Ein PR, der eine davon anfasst, wird abgelehnt. Die Checks laufen immer mit der `setup.json` vom Standard-Branch.

`requirements.md` braucht einen ausgefüllten Abschnitt „Nicht enthalten"; sonst stellt die Prüfung eine Rückfrage.

## EARS-Muster für Abnahmekriterien

| Muster | Form |
|---|---|
| Ereignis | WENN <Auslöser>, DANN SOLL <System> <Reaktion>. |
| Zustand | SOLANGE <Zustand>, SOLL <System> <Reaktion>. |
| Unerwünscht | FALLS <Fehlerfall>, DANN SOLL <System> <Reaktion>. |
| Optional | WO <Ausstattung vorhanden>, SOLL <System> <Reaktion>. |
| Immer | <System> SOLL <Reaktion>. |

Englische Schlüsselwörter (WHEN … THE SYSTEM SHALL …) sind ebenso erlaubt. Jede Reaktion ist prüfbar, mit Zahl und Einheit, wo es um Mengen, Zeiten oder Messwerte geht.
Kriterien sind nummeriert: Anforderung 2, Kriterium 2.3.

## Phasen in der Factory

- **Prüfung** (kurzer Lauf, baut nichts)
  - `requirements.md` vorhanden, jedes Kriterium prüfbar, widerspruchsfrei, passend zu `.kiro/steering/`?
  - Bei Freigabe: Testszenarien für die Abnahme nach `/scenarios/scenarios.md` (außerhalb des Repos)
  - Ergebnis: Freigegeben, Rückfrage oder Abgelehnt
- **Design** (eigener Lauf) → Skill `design` → `design.md` + `tasks.md` in einem Commit
  - Steht in `requirements.md` `Design-Freigabe: ja`: Halt im Status Design-Review, weiter mit Label `design-ok`
- **Umsetzung** → Skill `build`: `tasks.md` der Reihe nach, jede erledigte Aufgabe abhaken (`- [x]`) und committen
- **Abnahme** (eigener Lauf, unabhängig), zwei getrennte Prüfungen, Bericht in den PR:
  - Funktion: jedes Kriterium und jedes Holdout-Szenario gegen die laufende Anwendung
  - Wartbarkeit: Diff gegen `tech.md`, `structure.md` und `design.md` (Doppelungen, unnötige Komplexität, neue Abhängigkeiten, schwache Tests); blockierende Befunde gehen zurück in die Umsetzung

Status auf dem Board: Neu → In Prüfung → Freigegeben → Design → (Design-Review) → Design fertig → In Arbeit → Abnahme → Review → Fertig.

## Bugs

Kein Spec-Ordner nötig. Das Issue beschreibt Ist und Soll. Design-Lauf: Fehler reproduzieren, roten Test schreiben, kurze `tasks.md` unter `.kiro/specs/bug-<issue-nr>/`.

## Stack-Packs

Steht in `.kiro/steering/tech.md` unter „Stack-Packs" ein Name, gelten zusätzlich die Regeln aus `/factory/workflows/kiro/stacks/<name>.md`.
