import test from "node:test";
import assert from "node:assert/strict";
import { d1MemoryClient } from "./d1MemoryClient.js";

const originalFetch = globalThis.fetch;
const originalUrl = process.env.NEONVISION_MEMORY_URL;
const originalToken = process.env.NEONVISION_MEMORY_TOKEN;

test("D1 memory client sends authenticated requests and converts timestamps", async () => {
  process.env.NEONVISION_MEMORY_URL = "https://memory.example.workers.dev/";
  process.env.NEONVISION_MEMORY_TOKEN = "test-only-token";
  let captured: { url?: string; init?: RequestInit } = {};
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    captured = { url: String(input), init };
    return new Response(JSON.stringify({
      saved: true,
      message: {
        id: "m1", sessionId: "s1", role: "user",
        content: "A sufficiently long test message",
        timestamp: "2026-11-27T10:00:00.000Z"
      }
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    const message = await d1MemoryClient.addMessage("s1", "user", "A sufficiently long test message");
    assert.equal(captured.url, "https://memory.example.workers.dev/v1/messages/add");
    assert.equal(new Headers(captured.init?.headers).get("authorization"), "Bearer test-only-token");
    assert.ok(message?.timestamp instanceof Date);
    assert.equal(message?.sessionId, "s1");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.NEONVISION_MEMORY_URL;
    else process.env.NEONVISION_MEMORY_URL = originalUrl;
    if (originalToken === undefined) delete process.env.NEONVISION_MEMORY_TOKEN;
    else process.env.NEONVISION_MEMORY_TOKEN = originalToken;
  }
});

test("D1 memory client rejects non-success responses", async () => {
  process.env.NEONVISION_MEMORY_URL = "https://memory.example.workers.dev";
  process.env.NEONVISION_MEMORY_TOKEN = "test-only-token";
  globalThis.fetch = (async () => new Response("unavailable", { status: 503 })) as typeof fetch;
  try {
    await assert.rejects(
      d1MemoryClient.getStrategicMemory("s1"),
      /D1 memory request failed \(503\)/
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.NEONVISION_MEMORY_URL;
    else process.env.NEONVISION_MEMORY_URL = originalUrl;
    if (originalToken === undefined) delete process.env.NEONVISION_MEMORY_TOKEN;
    else process.env.NEONVISION_MEMORY_TOKEN = originalToken;
  }
});
