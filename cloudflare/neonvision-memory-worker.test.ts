import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import worker from "./neonvision-memory-worker.js";

const migration = readFileSync(new URL("./migrations/0001_initial_memory.sql", import.meta.url), "utf8");

class MemoryD1 {
  tables: Set<string>;
  messages: Array<Record<string, unknown>> = [];

  constructor(withSchema = true) {
    this.tables = new Set(withSchema ? [...migration.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map(m => m[1]) : []);
  }

  prepare(sql: string) {
    let values: unknown[] = [];
    const ensureTable = () => {
      const match = sql.match(/\b(?:FROM|INTO|UPDATE)\s+(\w+)/i);
      if (match && !this.tables.has(match[1])) throw new Error(`no such table: ${match[1]}`);
    };
    const statement = {
      bind: (...args: unknown[]) => { values = args; return statement; },
      all: async () => {
        ensureTable();
        if (sql.includes("LIMIT 0")) return { results: [] };
        const sessionId = values[0];
        const rows = this.messages.filter(m => m.sessionId === sessionId);
        const ordered = sql.includes("DESC") ? [...rows].reverse() : [...rows];
        return { results: ordered.slice(0, Number(values[1]) || 50) };
      },
      first: async () => {
        ensureTable();
        return this.messages.filter(m => m.sessionId === values[0]).at(-1) ?? null;
      },
      run: async () => {
        ensureTable();
        if (sql.startsWith("INSERT INTO chat_messages")) {
          const [id, sessionId, role, content, timestamp] = values;
          this.messages.push({ id, sessionId, role, content, timestamp });
        }
        return { success: true };
      },
    };
    return statement;
  }
}

const request = (path: string, body?: unknown, token?: string) => new Request(`https://worker.test${path}`, {
  method: path === "/health" ? "GET" : "POST",
  headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

test("health fails closed before migration and succeeds after schema exists", async () => {
  const missing = await worker.fetch(request("/health"), { DB: new MemoryD1(false) as any, NEONVISION_MEMORY_TOKEN: "secret" });
  assert.equal(missing.status, 503);
  const ready = await worker.fetch(request("/health"), { DB: new MemoryD1() as any, NEONVISION_MEMORY_TOKEN: "secret" });
  assert.equal(ready.status, 200);
});

test("message writes require the token and persist retrievable history", async () => {
  const DB = new MemoryD1();
  const env = { DB: DB as any, NEONVISION_MEMORY_TOKEN: "secret" };
  const unauthorized = await worker.fetch(request("/v1/messages/add", { sessionId: "s1", role: "user", content: "A valid test message" }), env);
  assert.equal(unauthorized.status, 401);

  const added = await worker.fetch(request("/v1/messages/add", { sessionId: "s1", role: "user", content: "A valid test message" }, "secret"), env);
  assert.equal(added.status, 200);
  assert.equal(DB.messages.length, 1);
  const history = await worker.fetch(request("/v1/messages/history", { sessionId: "s1" }, "secret"), env);
  assert.equal(history.status, 200);
  assert.equal((await history.json() as any).messages[0].content, "A valid test message");
});

