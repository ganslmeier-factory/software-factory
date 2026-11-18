// Software Factory – Konsole
// Kleine Weboberfläche im Heimnetz: Übersicht, Rollen und Modelle, Betrieb, Zugänge.
// Schreibt nur /etc/software-factory/config.json (mit Sicherung). Der Runner liest die Datei
// bei jedem Durchlauf neu, ein Neustart ist nicht nötig.
// Login per HTTP Basic Auth: Nutzer "factory", Passwort aus config.console.password.

import { readdirSync, readFileSync, renameSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { dirname, basename, join } from "node:path";
import { timingSafeEqual } from "node:crypto";
import {
  CONFIG_PATH, STATUS, STEPS, consoleState, factoryLogin, jobDir, listContainers, loadConfig, modelFor,
  readJobFile, readJobJson, type Config, type Phase,
} from "./main.ts";

export const ROLES: { key: Phase | "improve"; name: string; what: string }[] = [
  { key: "check", name: "Prüfung", what: "Liest requirements.md, stellt Rückfragen, schreibt Testszenarien" },
  { key: "design", name: "Design", what: "Schreibt design.md und tasks.md" },
  { key: "build", name: "Umsetzung", what: "Arbeitet tasks.md ab, schreibt Code und Tests" },
  { key: "accept", name: "Abnahme", what: "Prüft unabhängig jedes Kriterium" },
  { key: "improve", name: "Verbesserung", what: "Schlägt Verbesserungen an der Factory vor" },
];
export const MODEL_CHOICES = ["opus", "sonnet", "haiku"];

// ---------- Einstellungen prüfen und schreiben ----------

const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9.\-_\[\]]{1,63}$/;
const int = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

/** Übernimmt nur erlaubte Felder aus `update` in eine Kopie von `current`. Liefert Fehler statt zu raten. */
export function applyConfigUpdate(current: Record<string, any>, update: Record<string, any>): { config: Record<string, any>; errors: string[] } {
  const next = structuredClone(current);
  const errors: string[] = [];
  const known = new Set(["model", "models", "designPhase", "designGate", "maxParallel", "jobTimeoutMinutes", "containerMemory", "pollSeconds", "maxReworks"]);
  for (const k of Object.keys(update)) if (!known.has(k)) errors.push(`Feld ${k} kann hier nicht geändert werden`);

  if ("model" in update) {
    if (typeof update.model === "string" && MODEL_RE.test(update.model)) next.model = update.model;
    else errors.push("Standardmodell: ungültiger Name");
  }
  if ("models" in update) {
    if (typeof update.models !== "object" || update.models === null) errors.push("Modelle pro Rolle: ungültig");
    else {
      next.models = { ...(next.models ?? {}) };
      for (const [role, m] of Object.entries(update.models)) {
        if (!ROLES.some((r) => r.key === role)) { errors.push(`Unbekannte Rolle ${role}`); continue; }
        if (m === "" || m === null) delete next.models[role];
        else if (typeof m === "string" && MODEL_RE.test(m)) next.models[role] = m;
        else errors.push(`Modell für ${role}: ungültiger Name`);
      }
    }
  }
  if ("designPhase" in update) {
    if (typeof update.designPhase === "boolean") next.designPhase = update.designPhase; else errors.push("Design als eigener Lauf: ja oder nein");
  }
  if ("designGate" in update) {
    if (["spec", "always", "never"].includes(update.designGate)) next.designGate = update.designGate; else errors.push("Design-Freigabe: spec, always oder never");
  }
  const ints: [string, number, number, string][] = [
    ["maxParallel", 1, 8, "Gleichzeitige Läufe"], ["jobTimeoutMinutes", 10, 480, "Zeitlimit pro Lauf (Minuten)"],
    ["pollSeconds", 15, 600, "Abfrage-Intervall (Sekunden)"], ["maxReworks", 0, 5, "Rückgaben aus der Abnahme"],
  ];
  for (const [k, min, max, label] of ints) {
    if (k in update) { if (int(update[k], min, max)) next[k] = update[k]; else errors.push(`${label}: ganze Zahl von ${min} bis ${max}`); }
  }
  if ("containerMemory" in update) {
    if (typeof update.containerMemory === "string" && /^\d{1,3}(m|g)$/.test(update.containerMemory)) next.containerMemory = update.containerMemory;
    else errors.push("Speicher pro Lauf: z. B. 3g oder 2048m");
  }
  return { config: next, errors };
}

/** Schreibt die Config atomar mit Rechten 600 und hält die letzten 10 Sicherungen. */
export function writeConfig(path: string, config: Record<string, any>, now = new Date()) {
  const dir = dirname(path), base = basename(path);
  const backup = join(dir, `${base}.bak-${now.toISOString().replace(/[:.]/g, "-")}`);
  writeFileSync(backup, readFileSync(path)); chmodSync(backup, 0o600);
  const tmp = join(dir, `.${base}.tmp`);
  writeFileSync(tmp, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
  renameSync(tmp, path);
  const backups = readdirSync(dir).filter((f) => f.startsWith(`${base}.bak-`)).sort();
  for (const old of backups.slice(0, Math.max(0, backups.length - 10))) rmSync(join(dir, old));
}

/** Config ohne Passwörter, für die Anzeige */
export function publicConfig(c: Record<string, any>) {
  const out = structuredClone(c);
  if (out.preview?.password) out.preview.password = "***";
  if (out.console?.password) out.console.password = "***";
  return out;
}

// ---------- Kennzahlen ----------

export function weekStats(metrics: string, now = Date.now()) {
  const cutoff = now - 7 * 86400_000;
  const runs = metrics.split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter((r) => r && Date.parse(r.t) >= cutoff);
  const accepts = runs.filter((r) => r.phase === "accept");
  const builds = runs.filter((r) => r.phase === "build" && r.status === "accepting" && r.seconds);
  return {
    runs: runs.length,
    toReview: accepts.filter((r) => r.status === "review").length,
    acceptPassed: accepts.filter((r) => r.status === "review").length,
    acceptTotal: accepts.length,
    questions: runs.filter((r) => r.status === "question").length,
    failed: runs.filter((r) => r.status === "failed").length,
    buildMinutesAvg: builds.length ? Math.round(builds.reduce((a, r) => a + r.seconds, 0) / builds.length / 60) : null,
    costUsd: Math.round(runs.reduce((a, r) => a + (r.costUsd ?? 0), 0) * 100) / 100,
  };
}

// ---------- Zugriff ----------

export function authorized(header: string | null, password: string): boolean {
  if (!header?.startsWith("Basic ") || !password) return false;
  let decoded = "";
  try { decoded = atob(header.slice(6)); } catch { return false; }
  const want = Buffer.from(`factory:${password}`), got = Buffer.from(decoded);
  return want.length === got.length && timingSafeEqual(want, got);
}

// ---------- Server ----------

const HUMAN = new Set(["question", "rejected", "design_review", "review", "failed"]);

async function state(cfg: Config) {
  let jobs: Awaited<ReturnType<typeof listContainers>> = [];
  let dockerError = "";
  try { jobs = (await listContainers()).filter((c) => c.running); } catch (e) { dockerError = String(e).slice(0, 200); }
  const issues = [...consoleState.issues.values()].flat();
  const title = (repo: string, n: number) => issues.find((i) => i.repo === repo && i.number === n);
  const busy = new Set(jobs.map((j) => `${j.repo}#${j.issue}`));
  return {
    at: new Date().toISOString(),
    lastTickAt: consoleState.lastTickAt, lastError: consoleState.lastError || dockerError,
    slots: { total: cfg.maxParallel, used: jobs.length },
    running: jobs.map((j) => ({
      repo: j.repo, issue: j.issue, title: title(j.repo, j.issue)?.title ?? "", url: title(j.repo, j.issue)?.url ?? "",
      phase: j.phase, mode: j.mode, model: j.model ?? modelFor(cfg, j.phase),
      step: STEPS[readJobJson(join(jobDir(cfg, j.repo, j.issue), "status.json"), 10_000)?.step ?? ""] ?? "",
      minutes: Math.max(0, Math.round((Date.now() - Date.parse(j.startedAt)) / 60000)),
    })),
    issues: issues.filter((i) => !busy.has(`${i.repo}#${i.number}`))
      .map((i) => ({ ...i, stageName: STATUS[i.stage]?.name ?? i.stage, human: HUMAN.has(i.stage) })),
    repos: cfg.repos,
    stats: weekStats(readJobFile(join(cfg.dataDir, "metrics.jsonl"), 5_000_000) ?? ""),
    access: {
      claude: !!process.env.CLAUDE_CODE_OAUTH_TOKEN ? "Abo-Token gesetzt" : process.env.ANTHROPIC_API_KEY ? "API-Schlüssel gesetzt" : "fehlt",
      github: factoryLogin() || "unbekannt",
      preview: cfg.preview ? "an" : "aus",
    },
  };
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

export function handler(path = CONFIG_PATH) {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    if (url.pathname === "/healthz") return new Response("ok");
    const cfg = loadConfig(path);
    if (!authorized(req.headers.get("authorization"), cfg.console?.password ?? "")) {
      return new Response("Anmeldung erforderlich", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Factory-Konsole", charset="UTF-8"' } });
    }
    if (req.method === "GET" && url.pathname === "/") {
      return new Response(PAGE, { headers: {
        "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'",
        "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
      } });
    }
    if (req.method === "GET" && url.pathname === "/api/state") return json(await state(cfg));
    if (req.method === "GET" && url.pathname === "/api/config") {
      const raw = JSON.parse(readFileSync(path, "utf8"));
      return json({ config: publicConfig(raw), roles: ROLES, choices: MODEL_CHOICES, effective: Object.fromEntries(ROLES.map((r) => [r.key, modelFor(cfg, r.key)])) });
    }
    if (req.method === "POST" && url.pathname === "/api/config") {
      // Schutz vor Formularen fremder Seiten: nur eigene Aufrufe setzen diesen Kopf
      if (req.headers.get("x-factory-console") !== "1") return json({ errors: ["Aufruf nicht erlaubt"] }, 403);
      let update: Record<string, any>;
      try { update = await req.json(); } catch { return json({ errors: ["Kein gültiges JSON"] }, 400); }
      const raw = JSON.parse(readFileSync(path, "utf8"));
      const { config, errors } = applyConfigUpdate(raw, update);
      if (errors.length) return json({ errors }, 400);
      writeConfig(path, config);
      console.log(JSON.stringify({ t: new Date().toISOString(), event: "console:config", fields: Object.keys(update) }));
      return json({ ok: true, config: publicConfig(config) });
    }
    return new Response("Nicht gefunden", { status: 404 });
  };
}

export function startConsole(path = CONFIG_PATH) {
  const cfg = loadConfig(path);
  const port = cfg.console?.port ?? 8088;
  Bun.serve({ port, hostname: "0.0.0.0", fetch: handler(path) });
  console.log(JSON.stringify({ t: new Date().toISOString(), event: "console:started", port }));
}

// ---------- Seite (ORRYX Design System: Tiefblau, Cyber-Gelb als einziger Akzent, Eyebrows, 8-px-Raster) ----------

export const PAGE = /* html */ `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Factory · Konsole</title>
<style>
:root{--tiefblau:#0A1949;--tiefblau-invert:#9BB3E5;--cyber-gelb:#FFC700;--signalrot:#C81E2D;--signalrot-invert:#FF6B6B;--taktikgruen:#37503C;--taktikgruen-invert:#89A487;--stahlgrau:#555A64;
--bg:#FFFFFF;--bg-elevated:#F7F7F2;--bg-sunken:#ECEDEE;--surface:#FFFFFF;--surface-2:#F4F5F7;--fg1:#0A1949;--fg2:#2A2F3A;--fg3:#555A64;--fg4:#8892A4;--border-1:#DDE3ED;--border-2:#C7CFDD;--border-strong:#0A1949;
--accent:#0A1949;--accent-fg:#FFFFFF;--accent-hover:#142363;--signal:#C81E2D;--success:#37503C;--focus:#FFC700;
--font-sans:"Aptos",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;--font-mono:"Aptos Mono","JetBrains Mono",ui-monospace,"SF Mono",Menlo,Consolas,monospace;
--radius-sm:4px;--radius-md:6px;--radius-pill:999px}
@media (prefers-color-scheme:dark){:root{--bg:#0A1949;--bg-elevated:#0E1F5A;--bg-sunken:#07103A;--surface:#0E1F5A;--surface-2:#14266B;--fg1:#FFFFFF;--fg2:#E0E6F4;--fg3:#9BB3E5;--fg4:#6577A7;--border-1:rgba(155,179,229,.18);--border-2:rgba(155,179,229,.32);--border-strong:#9BB3E5;--accent:#FFC700;--accent-fg:#0A1949;--accent-hover:#FFD636;--signal:#FF6B6B;--success:#89A487}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg2);font:15px/1.5 var(--font-sans)}
header{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding:32px 48px 16px;border-bottom:1px solid var(--border-1)}
.eyebrow{font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--fg3);margin:0 0 8px}
h1{font-size:32px;line-height:1.2;font-weight:700;letter-spacing:-.02em;color:var(--fg1);margin:0}
h2{font-size:20px;line-height:1.2;font-weight:600;color:var(--fg1);margin:0 0 16px}
nav{display:flex;gap:4px;padding:0 48px;border-bottom:1px solid var(--border-1)}
nav button{background:none;border:0;border-bottom:2px solid transparent;color:var(--fg3);font:inherit;font-weight:600;padding:12px 16px;cursor:pointer;transition:opacity .15s ease-out}
nav button:hover{opacity:.7}nav button[aria-selected=true]{color:var(--fg1);border-bottom-color:var(--cyber-gelb)}
main{padding:32px 48px 64px;max-width:1200px}
section[hidden]{display:none}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:32px}
.tile{background:var(--surface);border:1px solid var(--border-1);border-radius:var(--radius-md);padding:16px}
.tile .v{font-size:32px;font-weight:700;color:var(--fg1);letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.tile .l{font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--fg3)}
.tile .s{font-size:13px;color:var(--fg3)}
.card{background:var(--surface);border:1px solid var(--border-1);border-radius:var(--radius-md);padding:24px;margin-bottom:24px}
table{width:100%;border-collapse:collapse}th{text-align:left;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--fg3);padding:8px 12px;border-bottom:1px solid var(--border-2)}
td{padding:12px;border-bottom:1px solid var(--border-1);vertical-align:middle}tr:last-child td{border-bottom:0}
.mono{font-family:var(--font-mono);font-size:.92em}.muted{color:var(--fg3)}.empty{color:var(--fg3);padding:12px}
a{color:var(--fg1);text-underline-offset:3px}
.pill{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:3px 10px;border-radius:var(--radius-pill);border:1px solid var(--border-2);color:var(--fg2)}
.dot{width:8px;height:8px;border-radius:50%;background:var(--fg4)}.dot.run{background:var(--success)}.dot.you{background:var(--cyber-gelb)}.dot.err{background:var(--signal)}
.bar{height:3px;background:var(--bg-sunken);overflow:hidden;border-radius:2px}.bar i{display:block;height:100%;background:var(--cyber-gelb)}
label.f{display:block;font-size:13px;font-weight:600;color:var(--fg1);margin-bottom:4px}
.hint{font-size:13px;color:var(--fg3);margin:4px 0 0}
select,input[type=text],input[type=number]{font:inherit;color:var(--fg1);background:var(--bg);border:1px solid var(--border-2);border-radius:var(--radius-md);padding:8px 10px;min-width:160px}
select:focus,input:focus,button:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px}
.btn{font:inherit;font-weight:600;border-radius:var(--radius-md);padding:10px 20px;cursor:pointer;border:1px solid var(--accent);background:var(--accent);color:var(--accent-fg);transition:transform .08s ease-out,background .15s ease-out}
.btn:hover{background:var(--accent-hover)}.btn:active{transform:scale(.98)}.btn[disabled]{opacity:.5;cursor:default}
.actions{display:flex;align-items:center;gap:16px;margin-top:24px}
.msg{font-size:13px}.msg.ok{color:var(--success)}.msg.err{color:var(--signal)}
.stamp{font-size:13px;color:var(--fg3);text-align:right}
@media (max-width:700px){header,nav,main{padding-left:16px;padding-right:16px}}
</style></head>
<body>
<header><div><p class="eyebrow">ORRYX · Software Factory</p><h1>Konsole</h1></div><div class="stamp" id="stamp">Lade …</div></header>
<nav role="tablist">
<button role="tab" aria-selected="true" data-tab="uebersicht">Übersicht</button>
<button role="tab" aria-selected="false" data-tab="rollen">Rollen</button>
<button role="tab" aria-selected="false" data-tab="betrieb">Betrieb</button>
<button role="tab" aria-selected="false" data-tab="zugaenge">Zugänge</button>
</nav>
<main>
<section id="uebersicht">
  <div class="tiles">
    <div class="tile"><div class="l">Plätze</div><div class="v" id="k-slots">–</div><div class="bar"><i id="k-bar" style="width:0"></i></div></div>
    <div class="tile"><div class="l">Läufe · 7 Tage</div><div class="v" id="k-runs">–</div><div class="s" id="k-fail"></div></div>
    <div class="tile"><div class="l">Abnahme bestanden</div><div class="v" id="k-acc">–</div><div class="s" id="k-dur"></div></div>
    <div class="tile"><div class="l">API-Kosten · 7 Tage</div><div class="v" id="k-cost">–</div><div class="s">rechnerisch, beim Abo nicht berechnet</div></div>
  </div>
  <div class="card"><p class="eyebrow">Läuft gerade</p><table><thead><tr><th>Issue</th><th>Phase</th><th>Modell</th><th>Seit</th></tr></thead><tbody id="t-run"></tbody></table></div>
  <div class="card"><p class="eyebrow">Du bist dran</p><table><tbody id="t-you"></tbody></table></div>
  <div class="card"><p class="eyebrow">Wartet</p><table><tbody id="t-wait"></tbody></table></div>
</section>
<section id="rollen" hidden>
  <div class="card">
    <h2>Modell pro Rolle</h2>
    <table><thead><tr><th>Rolle</th><th>Aufgabe</th><th>Modell</th></tr></thead><tbody id="t-roles"></tbody></table>
    <p class="hint">„Standard“ nimmt das Standardmodell. Eigene Namen, etwa eine feste Modellversion, über „Eigener Wert“.</p>
  </div>
  <div class="card grid2">
    <div><label class="f" for="f-model">Standardmodell</label><select id="f-model"></select><p class="hint">Gilt für jede Rolle ohne eigenes Modell.</p></div>
    <div><label class="f" for="f-gate">Design-Freigabe</label><select id="f-gate"><option value="spec">Wie in requirements.md</option><option value="always">Immer anhalten</option><option value="never">Nie anhalten</option></select><p class="hint">Halt nach design.md und tasks.md, weiter mit Label design-ok.</p></div>
    <div><label class="f" for="f-dphase">Design als eigener Lauf</label><select id="f-dphase"><option value="true">Ja</option><option value="false">Nein, mit der Umsetzung zusammen</option></select></div>
  </div>
  <div class="actions"><button class="btn" id="save-roles">Speichern</button><span class="msg" id="m-roles" role="status"></span></div>
</section>
<section id="betrieb" hidden>
  <div class="card grid2">
    <div><label class="f" for="f-par">Gleichzeitige Läufe</label><input type="number" id="f-par" min="1" max="8"><p class="hint">Über alle Projekte und Phasen. VM 130 verträgt 1–2.</p></div>
    <div><label class="f" for="f-timeout">Zeitlimit pro Lauf (Minuten)</label><input type="number" id="f-timeout" min="10" max="480"></div>
    <div><label class="f" for="f-mem">Speicher pro Lauf</label><input type="text" id="f-mem" placeholder="3g"></div>
    <div><label class="f" for="f-poll">Abfrage-Intervall (Sekunden)</label><input type="number" id="f-poll" min="15" max="600"></div>
    <div><label class="f" for="f-rework">Rückgaben aus der Abnahme</label><input type="number" id="f-rework" min="0" max="5"><p class="hint">Danach entscheidest du.</p></div>
  </div>
  <div class="actions"><button class="btn" id="save-ops">Speichern</button><span class="msg" id="m-ops" role="status"></span></div>
  <div class="card" style="margin-top:32px"><p class="eyebrow">Projekte</p><table><tbody id="t-repos"></tbody></table>
  <p class="hint">Neues Projekt anbinden: <span class="mono">sudo ./scripts/add-repo.sh &lt;owner/repo&gt;</span> auf VM 130. Update: <span class="mono">sudo factory-rollout</span>.</p></div>
</section>
<section id="zugaenge" hidden>
  <div class="card"><table><tbody id="t-access"></tbody></table>
  <p class="hint">Die Konsole zeigt nur, ob ein Zugang gesetzt ist, nie den Inhalt.</p></div>
</section>
</main>
<script>
const $=(s)=>document.querySelector(s);
const esc=(t)=>String(t??"").replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const PHASE={check:"Prüfung",design:"Design",build:"Umsetzung",accept:"Abnahme"};
const link=(i)=>i.url?'<a href="'+esc(i.url)+'" target="_blank" rel="noopener">'+esc(i.repo.split("/")[1])+' #'+i.issue+'</a>':esc(i.repo)+' #'+i.issue;
document.querySelectorAll("nav button").forEach((b)=>b.addEventListener("click",()=>{
  document.querySelectorAll("nav button").forEach((x)=>x.setAttribute("aria-selected",String(x===b)));
  document.querySelectorAll("main section").forEach((s)=>s.hidden=s.id!==b.dataset.tab);
}));
async function api(path,opts){const r=await fetch(path,opts);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error((d.errors||[r.statusText]).join(" · "));return d;}
async function loadState(){
  try{
    const s=await api("/api/state");
    $("#k-slots").textContent=s.slots.used+" / "+s.slots.total;
    $("#k-bar").style.width=Math.min(100,100*s.slots.used/Math.max(1,s.slots.total))+"%";
    $("#k-runs").textContent=s.stats.runs;
    $("#k-fail").textContent=s.stats.failed+" fehlgeschlagen · "+s.stats.questions+" Rückfragen";
    $("#k-acc").textContent=s.stats.acceptTotal?s.stats.acceptPassed+" / "+s.stats.acceptTotal:"–";
    $("#k-dur").textContent=s.stats.buildMinutesAvg!=null?"Umsetzung im Schnitt "+s.stats.buildMinutesAvg+" min":"";
    $("#k-cost").textContent=s.stats.costUsd.toFixed(2)+" $";
    $("#t-run").innerHTML=s.running.length?s.running.map((j)=>'<tr><td><span class="dot run" style="display:inline-block;margin-right:8px"></span>'+link(j)+'<div class="muted">'+esc(j.title)+'</div></td><td>'+esc(PHASE[j.phase]||j.phase)+(j.step?' <span class="muted">· '+esc(j.step)+'</span>':'')+'</td><td class="mono">'+esc(j.model)+'</td><td class="mono">'+j.minutes+' min</td></tr>').join(""):'<tr><td class="empty">Kein Lauf aktiv.</td></tr>';
    const row=(i,cls)=>'<tr><td><span class="dot '+cls+'" style="display:inline-block;margin-right:8px"></span>'+link({...i,issue:i.number})+' <span class="muted">'+esc(i.title)+'</span></td><td style="text-align:right"><span class="pill">'+esc(i.stageName)+'</span></td></tr>';
    const you=s.issues.filter((i)=>i.human),wait=s.issues.filter((i)=>!i.human);
    $("#t-you").innerHTML=you.length?you.map((i)=>row(i,i.stage==="failed"?"err":"you")).join(""):'<tr><td class="empty">Nichts offen.</td></tr>';
    $("#t-wait").innerHTML=wait.length?wait.map((i)=>row(i,"")).join(""):'<tr><td class="empty">Keine Warteschlange.</td></tr>';
    $("#t-repos").innerHTML=s.repos.map((r)=>'<tr><td class="mono">'+esc(r)+'</td><td class="muted" style="text-align:right">'+s.issues.filter((i)=>i.repo===r).length+' offene Issues</td></tr>').join("")||'<tr><td class="empty">Kein Projekt angebunden.</td></tr>';
    $("#t-access").innerHTML=[["Claude",s.access.claude],["GitHub-Login",s.access.github],["PR-Vorschau",s.access.preview]].map(([k,v])=>'<tr><td>'+k+'</td><td class="mono" style="text-align:right">'+esc(v)+'</td></tr>').join("");
    const age=s.lastTickAt?Math.round((Date.now()-Date.parse(s.lastTickAt))/1000):null;
    $("#stamp").innerHTML=(s.lastError?'<span style="color:var(--signal)">Letzter Durchlauf mit Fehler</span><br>':'')+(age==null?"Runner startet …":"Letzter Durchlauf vor "+(age<90?age+" s":Math.round(age/60)+" min"));
  }catch(e){$("#stamp").textContent="Keine Verbindung: "+e.message;}
}
let CFG=null,CHOICES=[];
function modelSelect(id,value,allowDefault){
  const opts=(allowDefault?['<option value="">Standard</option>']:[]).concat(CHOICES.map((m)=>'<option'+(m===value?" selected":"")+'>'+m+'</option>'));
  const custom=value&&!CHOICES.includes(value);
  opts.push('<option value="__custom"'+(custom?" selected":"")+'>Eigener Wert …</option>');
  return '<select id="'+id+'" data-custom="'+esc(custom?value:"")+'">'+opts.join("")+'</select>';
}
function readModel(sel){if(sel.value!=="__custom")return sel.value;const v=prompt("Modellname",sel.dataset.custom||"");return v===null?null:v.trim();}
async function loadConfig(){
  const d=await api("/api/config");CFG=d.config;CHOICES=d.choices;
  $("#t-roles").innerHTML=d.roles.map((r)=>'<tr><td><strong style="color:var(--fg1)">'+esc(r.name)+'</strong></td><td class="muted">'+esc(r.what)+'</td><td>'+modelSelect("r-"+r.key,(CFG.models||{})[r.key]||"",true)+' <span class="muted mono">→ '+esc(d.effective[r.key])+'</span></td></tr>').join("");
  $("#f-model").outerHTML=modelSelect("f-model",CFG.model||"opus",false);
  $("#f-gate").value=CFG.designGate||"spec";$("#f-dphase").value=String(CFG.designPhase!==false);
  $("#f-par").value=CFG.maxParallel??2;$("#f-timeout").value=CFG.jobTimeoutMinutes??90;$("#f-mem").value=CFG.containerMemory??"3g";$("#f-poll").value=CFG.pollSeconds??60;$("#f-rework").value=CFG.maxReworks??2;
}
async function save(body,msg,btn){
  btn.disabled=true;msg.className="msg";msg.textContent="Speichere …";
  try{await api("/api/config",{method:"POST",headers:{"Content-Type":"application/json","X-Factory-Console":"1"},body:JSON.stringify(body)});
    msg.className="msg ok";msg.textContent="Gespeichert. Gilt ab dem nächsten Lauf.";await loadConfig();}
  catch(e){msg.className="msg err";msg.textContent=e.message;}
  btn.disabled=false;
}
$("#save-roles").addEventListener("click",(ev)=>{
  const models={};for(const r of ["check","design","build","accept","improve"]){const v=readModel($("#r-"+r));if(v===null)return;models[r]=v;}
  const model=readModel($("#f-model"));if(model===null)return;
  save({model,models,designGate:$("#f-gate").value,designPhase:$("#f-dphase").value==="true"},$("#m-roles"),ev.currentTarget);
});
$("#save-ops").addEventListener("click",(ev)=>save({maxParallel:+$("#f-par").value,jobTimeoutMinutes:+$("#f-timeout").value,containerMemory:$("#f-mem").value.trim(),pollSeconds:+$("#f-poll").value,maxReworks:+$("#f-rework").value},$("#m-ops"),ev.currentTarget));
loadState();loadConfig().catch((e)=>{$("#m-roles").className="msg err";$("#m-roles").textContent=e.message;});
setInterval(loadState,15000);
</script>
</body></html>`;
