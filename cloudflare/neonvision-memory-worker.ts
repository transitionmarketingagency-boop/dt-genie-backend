export interface Env {
  DB: D1Database;
  NEONVISION_MEMORY_TOKEN: string;
}

type JsonRecord = Record<string, unknown>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

function asString(value: unknown, max = 3000): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function normalizeContent(value: unknown): string {
  return asString(value)
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3000);
}

function isGarbage(text: string): boolean {
  return !text || text.includes('"intent"') || text.includes('"examples"') ||
    text.includes('"response"') || text.includes('"category"') ||
    text.includes("FAQ [") || text.includes("Source:") ||
    text.includes("Phase ") || text.length > 2000;
}

function isLowValue(text: string): boolean {
  return !text || text.length < 10 || /^(ok|yes|no|hi|hello|hey)$/i.test(text);
}

function detectIndustry(message: string): string | null {
  const msg = message.toLowerCase();
  if (msg.includes("saas")) return "saas";
  if (msg.includes("ecom")) return "ecommerce";
  if (msg.includes("real estate")) return "real_estate";
  if (msg.includes("hotel")) return "hospitality";
  return null;
}

function safeParse<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value) return fallback;
  try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
}

function safeStringify(value: unknown): string {
  try { return JSON.stringify(value ?? null); } catch { return "null"; }
}

function unauthorized() {
  return json({ error: "Unauthorized" }, 401);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      try {
        await Promise.all([
          env.DB.prepare("SELECT id, sessionId, role, content, timestamp FROM chat_messages LIMIT 0").all(),
          env.DB.prepare("SELECT * FROM strategic_memory LIMIT 0").all(),
          env.DB.prepare("SELECT id, userId, serviceType, preferredTime, email, calendlyLink, status, createdAt FROM bookings LIMIT 0").all(),
        ]);
        return json({ ok: true, service: "neonvision-memory" });
      } catch {
        return json({ ok: false, service: "neonvision-memory", error: "Memory schema is not ready" }, 503);
      }
    }
    if (request.method !== "POST" || !url.pathname.startsWith("/v1/")) {
      return json({ error: "Not found" }, 404);
    }
    if (!env.NEONVISION_MEMORY_TOKEN ||
        request.headers.get("authorization") !== `Bearer ${env.NEONVISION_MEMORY_TOKEN}`) {
      return unauthorized();
    }

    let body: JsonRecord;
    try { body = await request.json() as JsonRecord; }
    catch { return json({ error: "Invalid JSON" }, 400); }

    const sessionId = asString(body.sessionId, 200);
    const action = url.pathname;

    try {
      if (action === "/v1/messages/add") {
        const role = body.role === "assistant" ? "assistant" : body.role === "user" ? "user" : "";
        const content = normalizeContent(body.content);
        if (!sessionId || !role || !content || isGarbage(content)) return json({ saved: false });
        const last = await env.DB.prepare(
          "SELECT id, content, timestamp FROM chat_messages WHERE sessionId = ? ORDER BY timestamp DESC LIMIT 1"
        ).bind(sessionId).first<{id:string;content:string;timestamp:string}>();
        if (last && normalizeContent(last.content) === content &&
            Date.now() - new Date(last.timestamp).getTime() < 5000) {
          return json({ saved: false, duplicate: true });
        }
        const id = crypto.randomUUID();
        const timestamp = new Date().toISOString();
        await env.DB.prepare(
          "INSERT INTO chat_messages (id, sessionId, role, content, timestamp) VALUES (?, ?, ?, ?, ?)"
        ).bind(id, sessionId, role, content, timestamp).run();
        return json({ saved: true, message: { id, sessionId, role, content, timestamp } });
      }

      if (action === "/v1/messages/history" || action === "/v1/messages/context" ||
          action === "/v1/messages/recent") {
        if (!sessionId) return json({ error: "sessionId required" }, 400);
        const limit = action.endsWith("/history") ? 50 :
          action.endsWith("/context") ? 15 : Math.min(40, Math.max(1, Number(body.limit) || 4) * 2);
        const order = action.endsWith("/history") ? "ASC" : "DESC";
        const result = await env.DB.prepare(
          `SELECT id, sessionId, role, content, timestamp FROM chat_messages WHERE sessionId = ? ORDER BY timestamp ${order} LIMIT ?`
        ).bind(sessionId, limit).all();
        let rows = (result.results || []).filter((row: any) =>
          !isLowValue(String(row.content || "")) && !isGarbage(String(row.content || ""))
        );
        if (action.endsWith("/context")) rows = rows.slice(0, 6);
        if (action.endsWith("/recent")) rows = rows.slice(0, Math.max(1, Number(body.limit) || 4));
        if (!action.endsWith("/history")) rows = rows.reverse();
        return json({ messages: rows });
      }

      if (action === "/v1/strategic/get") {
        if (!sessionId) return json({ error: "sessionId required" }, 400);
        const row = await env.DB.prepare("SELECT * FROM strategic_memory WHERE sessionId = ?")
          .bind(sessionId).first<any>();
        if (!row) return json({ memory: {} });
        const last = Number(row.lastInteraction || 0);
        return json({ memory: {
          industry: row.industry, businessType: row.businessType,
          goals: safeParse(row.goals, []), servicesDiscussed: safeParse(row.servicesDiscussed, []),
          leadScore: row.leadScore, stage: row.stage, budget: row.budget,
          timeline: row.timeline, decisionMaker: row.decisionMaker,
          interestLevel: row.interestLevel, lastUserProblem: row.lastUserProblem,
          lastDetectedServices: safeParse(row.lastDetectedServices, []),
          lastIntent: row.lastIntent, bantSignals: safeParse(row.bantSignals, {}),
          conversionProbability: row.conversionProbability, ctaReadiness: row.ctaReadiness,
          intentMomentum: row.intentMomentum, updatedAt: row.updatedAt,
          lastInteraction: last, isStale: Date.now() - last > 86400000
        }});
      }

      if (action === "/v1/strategic/upsert") {
        if (!sessionId || !body.data || typeof body.data !== "object") {
          return json({ error: "sessionId and data required" }, 400);
        }
        const existingRow = await env.DB.prepare("SELECT * FROM strategic_memory WHERE sessionId = ?")
          .bind(sessionId).first<any>();
        const incoming = body.data as JsonRecord;
        const detectedIndustry = typeof incoming.lastUserProblem === "string"
          ? detectIndustry(incoming.lastUserProblem)
          : null;
        const contextShift = Boolean(detectedIndustry && existingRow?.industry &&
          detectedIndustry !== existingRow.industry);
        const existing = existingRow && !contextShift ? {
          industry: existingRow.industry, businessType: existingRow.businessType,
          goals: safeParse(existingRow.goals, []), servicesDiscussed: safeParse(existingRow.servicesDiscussed, []),
          leadScore: existingRow.leadScore, stage: existingRow.stage, budget: existingRow.budget,
          timeline: existingRow.timeline, decisionMaker: existingRow.decisionMaker,
          interestLevel: existingRow.interestLevel, lastUserProblem: existingRow.lastUserProblem,
          lastDetectedServices: safeParse(existingRow.lastDetectedServices, []),
          lastIntent: existingRow.lastIntent, bantSignals: safeParse(existingRow.bantSignals, {}),
          conversionProbability: existingRow.conversionProbability, ctaReadiness: existingRow.ctaReadiness,
          intentMomentum: existingRow.intentMomentum
        } : {};
        const merged = { ...existing, ...incoming };
        const now = new Date().toISOString();
        const values = [
          sessionId, merged.industry ?? null, merged.businessType ?? null,
          safeStringify(merged.goals), safeStringify(merged.servicesDiscussed),
          merged.leadScore ?? null, merged.stage ?? null, merged.budget ?? null,
          merged.timeline ?? null, merged.decisionMaker ?? null, merged.interestLevel ?? null,
          merged.lastUserProblem ?? null, safeStringify(merged.lastDetectedServices),
          merged.lastIntent ?? null, safeStringify(merged.bantSignals),
          merged.conversionProbability ?? null, merged.ctaReadiness ?? null,
          merged.intentMomentum ?? null, now, Date.now()
        ];
        await env.DB.prepare(`INSERT INTO strategic_memory (
          sessionId, industry, businessType, goals, servicesDiscussed, leadScore, stage,
          budget, timeline, decisionMaker, interestLevel, lastUserProblem,
          lastDetectedServices, lastIntent, bantSignals, conversionProbability,
          ctaReadiness, intentMomentum, updatedAt, lastInteraction
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(sessionId) DO UPDATE SET
          industry=excluded.industry, businessType=excluded.businessType, goals=excluded.goals,
          servicesDiscussed=excluded.servicesDiscussed, leadScore=excluded.leadScore,
          stage=excluded.stage, budget=excluded.budget, timeline=excluded.timeline,
          decisionMaker=excluded.decisionMaker, interestLevel=excluded.interestLevel,
          lastUserProblem=excluded.lastUserProblem, lastDetectedServices=excluded.lastDetectedServices,
          lastIntent=excluded.lastIntent, bantSignals=excluded.bantSignals,
          conversionProbability=excluded.conversionProbability, ctaReadiness=excluded.ctaReadiness,
          intentMomentum=excluded.intentMomentum, updatedAt=excluded.updatedAt,
          lastInteraction=excluded.lastInteraction`).bind(...values).run();
        return json({ saved: true });
      }

      if (action === "/v1/bookings/create") {
        const userId = asString(body.userId, 200);
        if (!userId) return json({ error: "userId required" }, 400);
        const id = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO bookings (id, userId, serviceType, preferredTime, email, calendlyLink, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(id, userId, body.serviceType ?? null, body.preferredTime ?? null,
          body.email ?? null, body.calendlyLink ?? null, body.status ?? "pending",
          new Date().toISOString()).run();
        return json({ saved: true, id });
      }

      if (action === "/v1/bookings/status") {
        const bookingId = asString(body.bookingId, 200);
        const status = asString(body.status, 100);
        if (!bookingId || !status) return json({ error: "bookingId and status required" }, 400);
        await env.DB.prepare("UPDATE bookings SET status = ? WHERE id = ?")
          .bind(status, bookingId).run();
        return json({ updated: true });
      }

      return json({ error: "Unknown operation" }, 404);
    } catch (error) {
      console.error("NeonVision D1 operation failed", {
        path: action,
        message: error instanceof Error ? error.message : "Unknown error"
      });
      return json({ error: "Memory operation failed" }, 503);
    }
  }
};

