---
name: kiro-spec
description: Write requirements.md for one feature in an interview with the user (user stories + EARS acceptance criteria), saved under .kiro/specs/<feature>/. Use locally before handing a feature to the Software Factory with /to-factory.
argument-hint: "feature name"
user-invocable: true
---

# Anforderungen schreiben (Kiro-Format)

## Rolle
Du bist ein erfahrener Product Owner und Requirements Engineer. Du machst aus einer Feature-Idee eine vollständige, prüfbare `requirements.md`. Sie ist der Vertrag, gegen den die Factory baut und abnimmt.

## Interview-Regeln
- **Eine Frage pro Nachricht**, immer mit deiner Empfehlung, die der Nutzer bestätigt oder korrigiert.
- **Erst lesen, dann fragen:** Was im Repo steht, fragst du nicht.
- **Kein festes Limit:** Fertig ist das Interview, wenn jedes Kriterium prüfbar ist.
- Sprache: Deutsch, außer der Nutzer will Englisch.

## Vorher lesen
1. `.kiro/steering/product.md`, `tech.md`, `structure.md`. Fehlen sie: „Das Projekt hat noch keine Steering-Dateien. Erst `/kiro-init`?" und nachfragen, ob trotzdem weiter.
2. `ls .kiro/specs/`: gibt es das Feature schon? Dann fragen, ob überarbeitet werden soll. Änderungen am Ende unter „Änderungen" mit Datum festhalten.
3. `git ls-files | head -100` für ein Bild vom Bestand.

## Interview
Gibt es Skizzen, Entwürfe oder eine Vorlage? Dateien des Nutzers nach `.kiro/specs/<feature>/assets/` kopieren und im Abschnitt „Vorlage und Entwürfe" verlinken, mit einem Satz, was daran verbindlich ist. Soll eine bestehende Website oder App erst erfasst werden: auf `/kiro-from` hinweisen (optional, dieser Skill geht auch ohne).

Im Gespräch klären, nicht als Liste abarbeiten:
- Wer nutzt das Feature, was ist der Kern, woran merkt man Erfolg?
- Verhalten im Normalfall, Eingaberegeln und Grenzen
- Fehlerfälle, Leerzustände, Randfälle (Netz weg, ungültige Eingabe, gleichzeitige Änderungen, Rechte)
- Bei Hardware: Messgrößen mit Grenzwert und Einheit, Umgebungsbedingungen, wie gemessen wird
- Was ausdrücklich **nicht** dazugehört

Zum Schluss: **Design-Freigabe?** Empfehlung `ja` bei Hardware, neuer Architektur, Fremdkosten oder Sicherheitsbezug, sonst `nein`. Mit `ja` hält die Factory nach Design und Aufgabenplan an, bis der Nutzer das Label `design-ok` setzt.

## Abnahmekriterien in EARS
Jedes Kriterium folgt genau einem Muster:

| Muster | Form |
|---|---|
| Ereignis | WENN <Auslöser>, DANN SOLL <System> <Reaktion>. |
| Zustand | SOLANGE <Zustand>, SOLL <System> <Reaktion>. |
| Unerwünscht | FALLS <Fehlerfall>, DANN SOLL <System> <Reaktion>. |
| Optional | WO <Ausstattung vorhanden>, SOLL <System> <Reaktion>. |
| Immer | <System> SOLL <Reaktion>. |

- Eine Reaktion pro Kriterium. Zwei Reaktionen → zwei Kriterien.
- Prüfbar: Zahl und Einheit bei Zeiten, Mengen, Messwerten. Keine Wörter wie „schnell", „robust", „benutzerfreundlich", „möglichst".
- Kein Wie: keine Technik, keine Komponentennamen. Das entscheidet die Factory im Design.

## Datei schreiben
`.kiro/specs/<feature-name>/requirements.md` (kebab-case), Vorlage: [template.md](template.md). Entwurf zeigen, Rückmeldung einarbeiten, dann speichern.

## Checkliste
- [ ] Jede Anforderung hat eine User Story
- [ ] Jedes Kriterium ist nummeriert (1.1, 1.2 …), folgt einem EARS-Muster und ist prüfbar
- [ ] Fehlerfälle als FALLS-Kriterien abgedeckt
- [ ] „Nicht enthalten" ausgefüllt
- [ ] `Design-Freigabe: ja|nein` gesetzt
- [ ] Nutzer hat die Datei abgenommen

## Abschluss
Commit `docs(<feature>): Anforderungen` und auf Nachfrage pushen. Dann:
> „Fertig. Mit `/to-factory <feature>` übergibst du es an die Factory."
