import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyConfigUpdate, authorized, handler, publicConfig, weekStats, writeConfig } from "./console.ts";

const base = { repos: ["a/b"], model: "opus", maxParallel: 2, preview: { host: "x", password: "geheim" }, console: { password: "pw" } };

test("Konsole: erlaubte Felder werden übernommen, Rest bleibt", () => {
  const { config, errors } = applyConfigUpdate(base, {
    model: "sonnet", models: { build: "sonnet", design: "opus", accept: "" }, designGate: "always", designPhase: false,
    maxParallel: 1, jobTimeoutMinutes: 120, containerMemory: "4g", pollSeconds: 30, maxReworks: 3,
  });
  assert.deepEqual(errors, []);
  assert.equal(config.model, "sonnet");
  assert.deepEqual(config.models, { build: "sonnet", design: "opus" });
  assert.equal(config.designGate, "always");
  assert.equal(config.maxParallel, 1);
  assert.deepEqual(config.repos, ["a/b"]);
  assert.equal(config.preview.password, "geheim");
  assert.equal(base.model, "opus"); // Original unverändert
});

test("Konsole: ungültige oder fremde Felder werden abgelehnt", () => {
  const { errors } = applyConfigUpdate(base, {
    repos: ["x/y"], model: "op us; rm -rf", models: { hacker: "opus", build: "$(id)" }, designGate: "maybe",
    maxParallel: 99, containerMemory: "viel",
  });
  assert.equal(errors.length, 7, errors.join("\n"));
});

test("Konsole: Passwörter werden nie angezeigt", () => {
  const p = publicConfig(base);
  assert.equal(p.preview.password, "***");
  assert.equal(p.console.password, "***");
  assert.equal(base.preview.password, "geheim");
});

test("Konsole: Anmeldung nur mit richtigem Passwort", () => {
  const h = (s: string) => "Basic " + btoa(s);
  assert.ok(authorized(h("factory:pw"), "pw"));
  assert.ok(!authorized(h("factory:falsch"), "pw"));
  assert.ok(!authorized(h("admin:pw"), "pw"));
  assert.ok(!authorized(null, "pw"));
  assert.ok(!authorized(h("factory:"), ""));
});

test("Konsole: Schreiben mit Sicherung, Rechte 600, höchstens 10 Sicherungen", () => {
  const dir = mkdtempSync(join(tmpdir(), "sf-console-"));
  const path = join(dir, "config.json");
  writeFileSync(path, JSON.stringify(base));
  for (let i = 0; i < 12; i++) writeConfig(path, { ...base, maxParallel: i + 1 }, new Date(Date.UTC(2026, 10, 18, 8, 0, i)));
  assert.equal(JSON.parse(readFileSync(path, "utf8")).maxParallel, 12);
  assert.equal(statSync(path).mode & 0o777, 0o600);
  assert.equal(readdirSync(dir).filter((f) => f.startsWith("config.json.bak-")).length, 10);
});

test("Konsole: Wochenzahlen", () => {
  const now = Date.parse("2026-11-18T12:00:00Z");
  const m = (t: string, phase: string, status: string, seconds = 600) => JSON.stringify({ t, phase, status, seconds, costUsd: 1 });
  const s = weekStats([m("2026-11-01T10:00:00Z", "accept", "review"), m("2026-11-17T10:00:00Z", "build", "accepting", 1200),
    m("2026-11-17T11:00:00Z", "accept", "review"), m("2026-11-17T12:00:00Z", "accept", "working"), "kaputt"].join("\n"), now);
  assert.equal(s.runs, 3);
  assert.equal(s.acceptPassed, 1);
  assert.equal(s.acceptTotal, 2);
  assert.equal(s.buildMinutesAvg, 20);
  assert.equal(s.costUsd, 3);
});

test("Konsole: HTTP mit Anmeldung, Schutz vor fremden Formularen, Speichern", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sf-console-"));
  const path = join(dir, "config.json");
  writeFileSync(path, JSON.stringify({ ...base, dataDir: dir }));
  const h = handler(path);
  const auth = { authorization: "Basic " + btoa("factory:pw") };
  assert.equal((await h(new Request("http://x/"))).status, 401);
  assert.equal((await h(new Request("http://x/healthz"))).status, 200);
  const page = await h(new Request("http://x/", { headers: auth }));
  assert.equal(page.status, 200);
  assert.ok((await page.text()).includes("Konsole"));
  const cfg = await (await h(new Request("http://x/api/config", { headers: auth }))).json();
  assert.equal(cfg.config.console.password, "***");
  const body = JSON.stringify({ models: { build: "sonnet" } });
  assert.equal((await h(new Request("http://x/api/config", { method: "POST", headers: auth, body }))).status, 403);
  const ok = await h(new Request("http://x/api/config", { method: "POST", headers: { ...auth, "x-factory-console": "1" }, body }));
  assert.equal(ok.status, 200);
  assert.equal(JSON.parse(readFileSync(path, "utf8")).models.build, "sonnet");
  const bad = await h(new Request("http://x/api/config", { method: "POST", headers: { ...auth, "x-factory-console": "1" }, body: '{"maxParallel":0}' }));
  assert.equal(bad.status, 400);
});
