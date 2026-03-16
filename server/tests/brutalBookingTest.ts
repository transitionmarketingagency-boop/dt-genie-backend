// server/tests/brutalBookingTest.ts
import { shouldTriggerBooking } from "../services/bookingTrigger.js";
import { memoryService, StrategicMemory } from "../services/memoryService.js";
import { BANTSignals } from "../services/leadIntelligence.js";

interface MockMemory extends Partial<StrategicMemory> {
  leadScore?: number;
  bantSignals?: Record<keyof BANTSignals, number>;
  recentMessages?: string[];
}

async function runBrutalTests() {
  console.log("🧪 Starting brutal booking trigger tests...");

  const testSession = "test-session-brutal";

  // Helper to clear memory between tests
  if ("clearSession" in memoryService) {
    await (memoryService as any).clearSession(testSession);
  }

  // Define edge case test scenarios
  const testCases: {
    description: string;
    stage: string;
    memory: MockMemory;
    expected: boolean;
  }[] = [
    // --- Conversion Stage ---
    {
      description: "Conversion stage, high leadScore",
      stage: "conversion",
      memory: { leadScore: 0.8 },
      expected: true,
    },
    {
      description: "Conversion stage, low leadScore",
      stage: "conversion",
      memory: { leadScore: 0.4 },
      expected: false,
    },

    // --- Service Stage ---
    {
      description: "Service stage, moderate leadScore, strong BANT",
      stage: "service",
      memory: {
        leadScore: 0.55,
        bantSignals: { budget: 0.8, authority: 0.7, need: 0.7, timeline: 0.6 },
      },
      expected: true,
    },
    {
      description: "Service stage, moderate leadScore, weak BANT",
      stage: "service",
      memory: {
        leadScore: 0.55,
        bantSignals: { budget: 0.1, authority: 0.2, need: 0.1, timeline: 0.1 },
      },
      expected: false,
    },
    {
      description: "Service stage, borderline BANT with recent context boost",
      stage: "service",
      memory: {
        leadScore: 0.5,
        bantSignals: { budget: 0.4, authority: 0.4, need: 0.4, timeline: 0.4 },
        recentMessages: ["I want to book immediately", "Call me ASAP"],
      },
      expected: true,
    },

    // --- Strategy Stage ---
    {
      description: "Strategy stage, moderate leadScore, strong BANT",
      stage: "strategy",
      memory: {
        leadScore: 0.6,
        bantSignals: { budget: 0.7, authority: 0.7, need: 0.7, timeline: 0.6 },
      },
      expected: true,
    },
    {
      description: "Strategy stage, low leadScore",
      stage: "strategy",
      memory: {
        leadScore: 0.3,
        bantSignals: { budget: 0.8, authority: 0.8, need: 0.8, timeline: 0.8 },
      },
      expected: false,
    },
    {
      description: "Strategy stage, borderline leadScore and BANT",
      stage: "strategy",
      memory: {
        leadScore: 0.5,
        bantSignals: { budget: 0.5, authority: 0.5, need: 0.5, timeline: 0.5 },
      },
      expected: false,
    },

    // --- Edge Cases ---
    {
      description: "No memory at all",
      stage: "service",
      memory: {},
      expected: false,
    },
    {
      description: "LeadScore exactly at conversion threshold",
      stage: "conversion",
      memory: { leadScore: 0.65 },
      expected: true,
    },
    {
      description: "LeadScore exactly at service base threshold, strong BANT",
      stage: "service",
      memory: {
        leadScore: 0.5,
        bantSignals: { budget: 0.8, authority: 0.8, need: 0.8, timeline: 0.8 },
      },
      expected: true,
    },
    {
      description: "LeadScore above threshold but zero BANT",
      stage: "service",
      memory: {
        leadScore: 0.7,
        bantSignals: { budget: 0, authority: 0, need: 0, timeline: 0 },
      },
      expected: false,
    },
    {
      description: "Recent context alone triggers",
      stage: "service",
      memory: {
        leadScore: 0.45,
        bantSignals: { budget: 0.2, authority: 0.2, need: 0.2, timeline: 0.2 },
        recentMessages: ["ready to hire now", "urgent call needed"],
      },
      expected: false, // still under threshold
    },
    {
      description: "Maxed out BANT and recent context",
      stage: "strategy",
      memory: {
        leadScore: 0.6,
        bantSignals: { budget: 1, authority: 1, need: 1, timeline: 1 },
        recentMessages: ["book immediately", "call me ASAP"],
      },
      expected: true,
    },
  ];

  for (const test of testCases) {
    // Mock memory service responses
    const memory: StrategicMemory & { bantSignals?: Record<keyof BANTSignals, number> } =
      {
        leadScore: test.memory.leadScore ?? 0,
        bantSignals: test.memory.bantSignals ?? { budget: 0, authority: 0, need: 0, timeline: 0 },
      };

    // Mock recent context
    (memoryService as any).getStrategicMemory = async () => memory;
    (memoryService as any).getRecentContext = async () =>
      (test.memory.recentMessages ?? []).map((msg) => ({ content: msg }));

    const result = await shouldTriggerBooking(testSession, test.stage);

    const status = result === test.expected ? "✅" : "❌";
    console.log(
      `[${status}] ${test.description} -> Expected = ${test.expected}, Got = ${result}`
    );
  }

  console.log("🧪 Brutal booking trigger tests completed.");
}

runBrutalTests();
