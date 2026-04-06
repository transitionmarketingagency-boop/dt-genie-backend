// server/services/executionPlanner.ts
export async function generateExecutionPlan(services: string[]): Promise<string> {
  // Stub: generates a simple execution plan string
  return services.map((s, i) => `${i + 1}. Execute ${s} strategy`).join("\n");
}
