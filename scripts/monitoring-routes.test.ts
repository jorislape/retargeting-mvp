/**
 * Monitoring beta — route-level INTEGRATION proofs over real HTTP.
 * (`next/server` has no plain-node ESM export, so the handlers can't
 * be imported directly; instead this boots the actual dev server —
 * twice, with controlled env — and asserts over the wire.)
 *
 * Pass 1, flag OFF:  every monitoring route returns {disabled:true};
 *                    core routes still work.
 * Pass 2, flag ON,   cron rejects missing/wrong secret (401); with
 * DATABASE_URL="":   the right secret it exits cleanly (200
 *                    unavailable) — the DB-down behavior; cookie-less
 *                    GET returns the empty state WITHOUT setting a
 *                    cookie; POST add degrades to unavailable; core
 *                    debrief route works with no DATABASE_URL at all
 *                    (the core-isolation requirement).
 */
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";

const PORT = 3987;
const BASE = `http://localhost:${PORT}`;
const SECRET = "routes-test-secret";

function startServer(extraEnv: Record<string, string>): Promise<ChildProcess> {
  const child = spawn("npx", ["next", "dev", "-p", String(PORT)], {
    cwd: new URL("..", import.meta.url).pathname,
    env: { ...process.env, ...extraEnv },
    stdio: "ignore",
    detached: true,
  });
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 60_000;
    const poll = async () => {
      if (Date.now() > deadline) return reject(new Error("dev server never became ready"));
      try {
        const res = await fetch(`${BASE}/api/monitoring/competitors`);
        if (res.status > 0) return resolve(child);
      } catch {
        /* not up yet */
      }
      setTimeout(poll, 300);
    };
    setTimeout(poll, 700);
  });
}

function stopServer(child: ChildProcess): void {
  if (child.pid) {
    try {
      process.kill(-child.pid, "SIGTERM"); // detached => kill group
    } catch {
      child.kill("SIGTERM");
    }
  }
}

const json = async (path: string, init?: RequestInit) => {
  const res = await fetch(`${BASE}${path}`, init);
  return { status: res.status, body: await res.json(), headers: res.headers };
};

/* ---------------------- Pass 1: flag OFF -------------------------- */
{
  const server = await startServer({
    MONITORING_ENABLED: "",
    DATABASE_URL: "",
    CRON_SECRET: SECRET,
  });
  try {
    const disabled = { ok: false, disabled: true };
    assert.deepEqual((await json("/api/monitoring/competitors")).body, disabled);
    assert.deepEqual(
      (await json("/api/monitoring/competitors", { method: "POST", body: "{}" })).body,
      disabled
    );
    assert.deepEqual((await json("/api/monitoring/cron")).body, disabled);
    assert.deepEqual(
      (await json("/api/monitoring/competitors/x", { method: "DELETE" })).body,
      disabled
    );
    assert.deepEqual(
      (await json("/api/monitoring/competitors/x/retry", { method: "POST" })).body,
      disabled
    );
    assert.deepEqual(
      (await json("/api/monitoring/competitors/x/resume", { method: "POST" })).body,
      disabled
    );
    // Core keeps working with monitoring off and no DATABASE_URL.
    const gen = await fetch(`${BASE}/generator`);
    assert.equal(gen.status, 200);
  } finally {
    stopServer(server);
  }
}

/* ------------- Pass 2: flag ON, DATABASE_URL unset ----------------- */
{
  const server = await startServer({
    MONITORING_ENABLED: "true",
    DATABASE_URL: "", // overrides any .env.local value
    CRON_SECRET: SECRET,
  });
  try {
    // Cron auth: missing => 401; wrong => 401 (constant-time compare).
    assert.equal((await json("/api/monitoring/cron")).status, 401);
    assert.equal(
      (
        await json("/api/monitoring/cron", {
          headers: { authorization: "Bearer wrong" },
        })
      ).status,
      401
    );
    // Right secret, DB unavailable: clean 200 exit, degraded body.
    const cron = await json("/api/monitoring/cron", {
      headers: { authorization: `Bearer ${SECRET}` },
    });
    assert.equal(cron.status, 200);
    assert.deepEqual(cron.body, { ok: false, unavailable: true });

    // Cookie-less GET: empty state, NO cookie minted, no DB needed.
    const list = await json("/api/monitoring/competitors");
    assert.equal(list.status, 200);
    assert.equal(list.body.ok, true);
    assert.equal(list.body.workspace, false);
    assert.deepEqual(list.body.competitors, []);
    assert.equal(list.headers.get("set-cookie"), null, "GET must never mint");

    // POST add with DB down: degrades, never crashes.
    const add = await json("/api/monitoring/competitors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/" }),
    });
    assert.equal(add.status, 200);
    assert.deepEqual(add.body, { ok: false, unavailable: true });

    // Bad input is rejected before any workspace/DB work.
    const bad = await json("/api/monitoring/competitors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "" }),
    });
    assert.equal(bad.status, 400);

    // CORE-ISOLATION requirement: the debrief route functions with
    // DATABASE_URL unset — a real memo generates end to end.
    const form = new FormData();
    form.append(
      "csv",
      new File(
        [
          "Ad name,Amount spent (USD),Website purchase ROAS\n" +
            "UGC_Test_V1,100,2.5\nStatic_Test_V2,120,1.1\n",
        ],
        "t.csv",
        { type: "text/csv" }
      )
    );
    form.append("kpi", "roas");
    form.append("product", "Test product");
    form.append("offer", "Test offer");
    form.append("goal", "Test goal");
    form.append("creativeNotes", "");
    form.append("marketContext", "");
    const debrief = await fetch(`${BASE}/api/debrief`, {
      method: "POST",
      body: form,
    });
    const memo = await debrief.json();
    assert.equal(debrief.status, 200);
    assert.equal(memo.ok, true, "core debrief must work with DATABASE_URL unset");
  } finally {
    stopServer(server);
  }
}

console.log("monitoring-routes: all assertions passed");
