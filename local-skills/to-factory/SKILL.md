---
name: to-factory
description: Hand a finished requirements.md (.kiro/specs/<feature>/) to the Software Factory by creating a GitHub issue with the factory label. Use after /kiro-spec, once the spec is committed and pushed.
argument-hint: "feature name"
user-invocable: true
disable-model-invocation: true
---

# An die Software Factory übergeben

## Schritte

1. **Spec finden:** `.kiro/specs/<feature>/requirements.md`. Fehlt sie: „Für <feature> gibt es noch keine Anforderungen. Erst `/kiro-spec <feature>` oder, mit einer Vorlage, `/kiro-from <url> <feature>`." und aufhören. Ohne Argument: Ordner unter `.kiro/specs/` ohne `design.md` auflisten und fragen, welcher gemeint ist.

2. **Liegt sie auf GitHub?** Die Factory liest vom Standard-Branch.
   - Standard-Branch: `gh repo view --json defaultBranchRef --jq .defaultBranchRef.name`
   - `git fetch origin`, dann `git diff --quiet origin/<standard-branch> -- .kiro/`
   - Ist etwas nicht committet oder nicht gepusht: sagen, was fehlt, und fragen, ob du committen und pushen sollst. Nicht ungefragt pushen.

3. **Doppelte Übergabe vermeiden:** `gh issue list --label factory --state open --search "<feature> in:title" --json number,title`. Gibt es schon ein offenes Issue: Link zeigen und aufhören.

4. **Issue anlegen:**
   - Titel: `<feature>: <Titel aus requirements.md>`
   - Label: `factory`
   - Text:
     ```
     Spec: .kiro/specs/<feature>/requirements.md

     <Einleitung aus requirements.md, ein bis zwei Sätze>

     Anforderungen: <Anzahl>, Abnahmekriterien: <Anzahl>, Design-Freigabe: <ja|nein>
     ```
   - `gh issue create --label factory --title "…" --body-file <datei>`

5. **Rückmeldung:** Issue-Link. Die Factory übernimmt innerhalb einer Minute; den Stand siehst du am Label des Issues und auf dem Board. Bei `Design-Freigabe: ja` meldet sie sich mit Links zu `design.md` und `tasks.md`; freigeben mit dem Label `design-ok`.
